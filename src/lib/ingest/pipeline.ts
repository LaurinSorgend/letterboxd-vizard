import { enrichFilms, enrichOmdb, fetchCollections, fetchFeed } from '$lib/api/endpoints';
import { parseExport } from '$lib/ingest/parse';
import { feedHasGap, mergeFeed } from '$lib/ingest/rss';
import type {
	CollectionParts,
	EnrichedFilm,
	FeedEntry,
	Film,
	LetterboxdData,
	OmdbRatings,
	WatchlistEntry,
	WatchlistFilm
} from '$lib/types';
import { blankProfile } from './film';

export interface Progress {
	stage: 'films' | 'ratings';
	done: number;
	total: number;
}

/**
 * Reads an export zip and adds the feed entries logged after the export was made. The export
 * alone still loads if the feed fails.
 */
export async function loadExport(bytes: Uint8Array): Promise<LetterboxdData> {
	let parsed: LetterboxdData;
	try {
		parsed = parseExport(bytes);
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause);
		throw new Error(
			`${message}. Make sure you drop the unmodified zip downloaded from Letterboxd.`
		);
	}
	const username = parsed.profile?.username;
	const feed = username ? await fetchFeed(username).catch(() => []) : [];
	const { library, newFilms } = mergeFeed(parsed.films, feed);
	return { ...parsed, films: [...library, ...newFilms] };
}

/** A library from a member's public feed alone: their latest diary entries and no watchlist. */
export async function loadFeed(username: string): Promise<LetterboxdData> {
	const feed = await fetchFeed(username);
	if (feed.length === 0) throw new Error(`${username} has no diary entries in their RSS feed.`);
	return {
		films: mergeFeed([], feed).newFilms,
		watchlist: [],
		profile: blankProfile(username)
	};
}

async function ratingsFor(
	films: { tmdb: EnrichedFilm['tmdb'] }[],
	report: (progress: Progress) => void
): Promise<Map<string, OmdbRatings | null>> {
	const imdbIds = [...new Set(films.map((f) => f.tmdb?.imdbId).filter((id): id is string => !!id))];
	report({ stage: 'ratings', done: 0, total: imdbIds.length });
	if (imdbIds.length === 0) return new Map();
	return enrichOmdb(imdbIds, (done, total) => report({ stage: 'ratings', done, total }));
}

/** Joins films (and the watchlist) with TMDB records, then OMDb ratings for every IMDb match. */
export async function enrichLibrary(
	films: Film[],
	watchlist: WatchlistEntry[],
	report: (progress: Progress) => void
): Promise<{ films: EnrichedFilm[]; watchlist: WatchlistFilm[] }> {
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
		watchlist: enrichedWatchlist
	};
}

/** Billed cast kept per watchlist film: enough to search by, light enough for the snapshot. */
const WATCHLIST_CAST = 5;

/**
 * TMDB records for the watchlist, trimmed of what the watchlist view never reads so a long
 * watchlist doesn't crowd the watched library out of the browser's storage quota.
 */
async function enrichWatchlist(
	watchlist: WatchlistEntry[],
	onProgress: (done: number) => void
): Promise<WatchlistFilm[]> {
	const enriched = await enrichFilms(watchlist, onProgress);
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

/** Merges a feed into an analysed library, looking up only the films the feed introduced. */
export async function refreshFromFeed(
	library: EnrichedFilm[],
	feed: FeedEntry[]
): Promise<{ films: EnrichedFilm[]; addedEntries: number; gap: boolean }> {
	const gap = feedHasGap(library, feed);
	const merged = mergeFeed(library, feed);
	const { films: added } = await enrichLibrary(merged.newFilms, [], () => {});
	return { films: [...merged.library, ...added], addedEntries: merged.addedEntries, gap };
}
