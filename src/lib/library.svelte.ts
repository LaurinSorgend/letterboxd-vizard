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

	/** Loads a library, enriches it, and shows it; any failure lands back on the start screen. */
	async #analyse(source: LibrarySource, load: () => Promise<LetterboxdData>): Promise<void> {
		this.error = null;
		this.feedNote = null;
		this.phase = 'working';
		this.progress = { stage: 'films', done: 0, total: 0 };
		try {
			const parsed = await load();
			this.source = source;
			this.profile = parsed.profile;
			const library = await enrichLibrary(parsed.films, parsed.watchlist, (next) => {
				this.progress = next;
			});
			this.watchlist = library.watchlist;
			await this.#setFilms(library.films);
			if (source === 'feed') this.feedNote = FEED_ONLY_NOTE;
			this.phase = 'ready';
		} catch (cause) {
			this.error = cause instanceof Error ? cause.message : String(cause);
			this.phase = 'idle';
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
