import { createContext } from 'svelte';
import { noun } from '$lib/format';
import { fetchFeed } from '$lib/api/endpoints';
import {
	collectionsFor,
	enrichLibrary,
	loadExport,
	loadFeed,
	refreshFromFeed,
	type Progress
} from '$lib/ingest/pipeline';
import { FEED_FILM_LIMIT } from '$lib/ingest/rss';
import { excludedIds } from '$lib/recommend/recommend';
import { clearSnapshot, loadSnapshot, saveSnapshot, type LibrarySource } from '$lib/store';
import type {
	CollectionParts,
	EnrichedFilm,
	LetterboxdData,
	Profile,
	WatchlistFilm
} from '$lib/types';

type Phase = 'idle' | 'working' | 'ready';

const FEED_ONLY_NOTE = `Only your ${FEED_FILM_LIMIT} latest diary entries.`;

/** Share of unmatched films above which the TMDB lookup counts as failed. */
export const LOOKUP_FAILURE_SHARE = 0.5;

/**
 * The library this visit works on: how it was loaded, the analysed films and watchlist, and
 * whether it is remembered on this device. A load or a feed top-up sets the films through
 * `#setFilms`, which recomputes franchise sizes and then saves; `restore` takes a snapshot back
 * exactly as it was saved.
 */
export class Library {
	phase = $state<Phase>('idle');
	progress = $state<Progress>({ stage: 'films', done: 0, total: 0 });
	/** Why the last load failed; shown on the start screen. */
	error = $state<string | null>(null);
	films = $state.raw<EnrichedFilm[]>([]);
	watchlist = $state.raw<WatchlistFilm[]>([]);
	collections = $state.raw<CollectionParts[]>([]);
	profile = $state.raw<Profile | null>(null);
	source = $state<LibrarySource>('export');
	remember = $state(false);
	saveError = $state<string | null>(null);
	feedNote = $state<string | null>(null);
	/** The feed starts after the last known viewing, so only a fresh export fills the gap. */
	feedGap = $state(false);
	/** Whether recommendations may suggest films already on the watchlist. */
	includeWatchlist = $state(false);
	/** Where the running load comes from, so its progress can be worded to match. */
	loadingSource = $state<LibrarySource>('export');
	/** The username typed on the start screen; kept when a load fails. */
	usernameDraft = $state('');
	#controller: AbortController | null = null;
	#cancelTo: Phase = 'idle';

	/** Whether TMDB could not match more than `LOOKUP_FAILURE_SHARE` of the films. */
	readonly lookupFailed = $derived(
		this.films.length > 0 &&
			this.films.filter((f) => !f.tmdb).length / this.films.length > LOOKUP_FAILURE_SHARE
	);
	/** Whether a loaded library is there to go back to. */
	readonly canResume = $derived(this.films.length > 0);
	/** TMDB ids recommendations must leave out. */
	readonly recommendExclude = $derived(excludedIds(this, this.includeWatchlist));
	/** A feed-only library, or one with a gap the feed cannot fill, is completed by an export. */
	readonly offersExport = $derived(this.source === 'feed' || this.feedGap);
	readonly displayName = $derived(this.profile?.givenName || this.profile?.username || null);

	loadFile(file: File): Promise<void> {
		return this.#analyse('export', async () =>
			loadExport(new Uint8Array(await file.arrayBuffer()))
		);
	}

	loadUsername(username: string): Promise<void> {
		this.usernameDraft = username;
		return this.#analyse('feed', () => loadFeed(username));
	}

	/** Picks up a remembered library, then tops it up from the feed. */
	restore(): void {
		const snapshot = loadSnapshot();
		if (!snapshot) return;
		this.films = snapshot.films;
		this.watchlist = snapshot.watchlist;
		this.collections = snapshot.collections;
		this.profile = snapshot.profile;
		this.source = snapshot.source;
		this.remember = true;
		this.phase = 'ready';
		void this.#syncFeed();
	}

	/** Back to the start screen, to load another library. */
	startOver(): void {
		this.phase = 'idle';
	}

	/** Tops a remembered library up with whatever the member logged since it was saved. */
	async #syncFeed(): Promise<void> {
		const username = this.profile?.username;
		if (!username) return;
		try {
			const refresh = await refreshFromFeed(this.films, await fetchFeed(username));
			this.feedGap = refresh.gap;
			this.feedNote = refresh.gap
				? 'Some diary entries are missing.'
				: this.source === 'feed'
					? FEED_ONLY_NOTE
					: null;
			if (refresh.addedEntries === 0) return;
			await this.#setFilms(refresh.films, this.collections);
			if (!refresh.gap) this.feedNote = this.#entriesNote(refresh.addedEntries);
		} catch {
			this.feedNote = 'Could not check for new diary entries.';
		}
	}

	setRemember(on: boolean): void {
		this.remember = on;
		if (on) this.#persist();
		else {
			clearSnapshot();
			this.saveError = null;
		}
	}

	#entriesNote(count: number): string {
		const added = `${count} new diary ${noun(count, 'entry', 'entries')}.`;
		return this.source === 'feed' ? `${added} ${FEED_ONLY_NOTE}` : added;
	}

	/** Stops the running load or lookup and returns to where it started. */
	cancel(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.phase = this.#cancelTo;
		this.progress = { stage: 'films', done: 0, total: 0 };
	}

	/** Back to the loaded library from the start screen. */
	resume(): void {
		if (this.films.length > 0) this.phase = 'ready';
	}

	/** Looks up the films and watchlist entries TMDB did not match again, keeping their order. */
	async retryLookup(): Promise<void> {
		const missing = this.films.filter((f) => !f.tmdb);
		const missingWatch = this.watchlist.filter((f) => !f.tmdb);
		const controller = this.#begin('ready');
		this.error = null;
		await this.#mergeLookup(controller, missing, missingWatch).catch(() => {});
		if (controller !== this.#controller) return;
		this.phase = 'ready';
		this.#controller = null;
	}

	/** Enriches the unmatched entries and swaps each one for its new lookup. */
	async #mergeLookup(
		controller: AbortController,
		missing: EnrichedFilm[],
		missingWatch: WatchlistFilm[]
	): Promise<void> {
		const found = await enrichLibrary(
			missing,
			missingWatch,
			this.#reporter(controller),
			controller.signal
		);
		if (controller !== this.#controller) return;
		const filmMap = new Map(missing.map((f, i) => [f, found.films[i]]));
		const watchMap = new Map(missingWatch.map((f, i) => [f, found.watchlist[i]]));
		this.watchlist = this.watchlist.map((f) => watchMap.get(f) ?? f);
		await this.#setFilms(
			this.films.map((f) => filmMap.get(f) ?? f),
			this.collections
		);
	}

	/** Starts a cancellable run that `cancel` returns from to `cancelTo`. */
	#begin(cancelTo: Phase): AbortController {
		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		this.#cancelTo = cancelTo;
		this.phase = 'working';
		this.progress = { stage: 'films', done: 0, total: 0 };
		return controller;
	}

	/** Progress updates that stop once the run is cancelled or superseded. */
	#reporter(controller: AbortController): (next: Progress) => void {
		return (next) => {
			if (controller === this.#controller) this.progress = next;
		};
	}

	/** Loads a library, enriches it, and shows it; any failure lands back on the start screen. */
	async #analyse(source: LibrarySource, load: () => Promise<LetterboxdData>): Promise<void> {
		const controller = this.#begin('idle');
		this.loadingSource = source;
		this.error = null;
		this.feedNote = null;
		try {
			const parsed = await load();
			if (controller !== this.#controller) return;
			const library = await enrichLibrary(
				parsed.films,
				parsed.watchlist,
				this.#reporter(controller),
				controller.signal
			);
			if (controller !== this.#controller) return;
			this.source = source;
			this.profile = parsed.profile;
			this.watchlist = library.watchlist;
			await this.#setFilms(library.films);
			if (controller !== this.#controller) return;
			if (source === 'feed') this.feedNote = FEED_ONLY_NOTE;
			this.phase = 'ready';
			this.#controller = null;
		} catch (cause) {
			if (controller !== this.#controller) return;
			this.error = cause instanceof Error ? cause.message : String(cause);
			this.phase = 'idle';
			this.#controller = null;
		}
	}

	async #setFilms(films: EnrichedFilm[], knownCollections: CollectionParts[] = []): Promise<void> {
		this.films = films;
		this.collections = await collectionsFor(films, knownCollections);
		if (this.remember) this.#persist();
	}

	#persist(): void {
		const { films, watchlist, profile, collections, source } = this;
		if (saveSnapshot({ films, watchlist, profile, collections, source })) {
			this.saveError = null;
		} else {
			clearSnapshot();
			this.remember = false;
			this.saveError =
				'Could not save: your library is too large for this browser. Data stays for this visit only.';
		}
	}
}

export const [getLibrary, setLibrary] = createContext<Library>();
