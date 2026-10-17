import { enrichFilms, enrichOmdb, fetchCollections } from '$lib/ingest/enrich';
import { feedHasGap, mergeFeed, type FeedEntry } from '$lib/ingest/rss';
import { watchedTmdbIds } from '$lib/viz/seeds';
import type {
	CollectionParts,
	EnrichedFilm,
	Film,
	OmdbRatings,
	TmdbMovie,
	WatchlistEntry,
	WatchlistFilm
} from '$lib/types';

export interface Progress {
	stage: 'films' | 'ratings';
	done: number;
	total: number;
}

export interface EnrichedLibrary {
	films: EnrichedFilm[];
	watchlist: WatchlistFilm[];
	watchlistIds: number[];
}

/** Loads a member's public feed through /api/feed; throws with the server's message on failure. */
export async function fetchFeed(username: string): Promise<FeedEntry[]> {
	const response = await fetch(`/api/feed/${encodeURIComponent(username.trim())}`);
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new Error(body?.message ?? `Feed request failed (${response.status})`);
	}
	return ((await response.json()) as { entries: FeedEntry[] }).entries;
}

async function ratingsFor(
	films: (Film & { tmdb: EnrichedFilm['tmdb'] })[],
	report: (progress: Progress) => void
): Promise<Map<string, OmdbRatings | null>> {
	const imdbIds = [...new Set(films.map((f) => f.tmdb?.imdbId).filter((id): id is string => !!id))];
	report({ stage: 'ratings', done: 0, total: imdbIds.length });
	if (imdbIds.length === 0) return new Map();
	return enrichOmdb(imdbIds, (done, total) => report({ stage: 'ratings', done, total })).catch(
		() => new Map<string, OmdbRatings | null>()
	);
}

/** Joins films (and the watchlist) with TMDB records, then OMDb ratings for every IMDb match. */
export async function enrichLibrary(
	films: Film[],
	watchlist: WatchlistEntry[],
	report: (progress: Progress) => void
): Promise<EnrichedLibrary> {
	const total = films.length + watchlist.length;
	const done = { films: 0, watchlist: 0 };
	const tick = () => report({ stage: 'films', done: done.films + done.watchlist, total });
	tick();
	const [watched, enrichedWatchlist] = await Promise.all([
		enrichFilms(films, (n) => ((done.films = n), tick())),
		enrichWatchlist(watchlist, (n) => ((done.watchlist = n), tick()))
	]);
	const omdb = await ratingsFor(watched, report);
	return {
		films: watched.map((f) => ({
			...f,
			omdb: f.tmdb?.imdbId ? (omdb.get(f.tmdb.imdbId) ?? null) : null
		})),
		watchlist: enrichedWatchlist,
		watchlistIds: watchedTmdbIds(enrichedWatchlist)
	};
}

/** Billed cast kept per watchlist film: enough to search by, light enough for the snapshot. */
const WATCHLIST_CAST = 5;

/**
 * TMDB records for the watchlist, trimmed of what the watchlist view never reads so a long
 * watchlist doesn't crowd the watched library out of the browser's storage quota.
 */
export async function enrichWatchlist(
	watchlist: WatchlistEntry[],
	onProgress: (done: number) => void = () => {}
): Promise<(WatchlistFilm & { tmdb: TmdbMovie | null })[]> {
	const enriched = await enrichFilms(watchlist, onProgress).catch(() =>
		watchlist.map((entry) => ({ ...entry, tmdb: null }))
	);
	return enriched.map((film) => ({
		...film,
		tmdb: film.tmdb
			? { ...film.tmdb, cast: film.tmdb.cast.slice(0, WATCHLIST_CAST), keywords: [] }
			: null
	}));
}

/** Franchise sizes for every collection in the library that `known` does not already cover. */
export async function collectionsFor(
	films: EnrichedFilm[],
	known: CollectionParts[] = []
): Promise<CollectionParts[]> {
	const have = new Set(known.map((c) => c.id));
	const ids = films
		.map((film) => film.tmdb?.collection?.id)
		.filter((id): id is number => id != null && !have.has(id));
	return [...known, ...(ids.length > 0 ? await fetchCollections(ids) : [])];
}

export interface FeedRefresh {
	films: EnrichedFilm[];
	addedEntries: number;
	gap: boolean;
}

/** Merges a feed into an analysed library, looking up only the films the feed introduced. */
export async function refreshFromFeed(
	library: EnrichedFilm[],
	feed: FeedEntry[]
): Promise<FeedRefresh> {
	const gap = feedHasGap(library, feed);
	const merged = mergeFeed<EnrichedFilm>(library, feed, (film) => ({
		...film,
		tmdb: null,
		omdb: null
	}));
	if (merged.newFilms.length === 0)
		return { films: merged.films, addedEntries: merged.addedEntries, gap };
	const { films: enriched } = await enrichLibrary(merged.newFilms, [], () => {});
	const byUri = new Map(enriched.map((film) => [film.uri, film]));
	return {
		films: merged.films.map((film) => byUri.get(film.uri) ?? film),
		addedEntries: merged.addedEntries,
		gap
	};
}
