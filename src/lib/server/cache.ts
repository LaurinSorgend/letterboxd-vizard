import type { D1Database } from '@cloudflare/workers-types';
import type { TmdbMovie } from '$lib/types';

const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RELATED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** D1 allows at most 100 bound parameters per query. */
const MAX_PARAMS = 100;

function chunks<T>(list: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let start = 0; start < list.length; start += size) {
		out.push(list.slice(start, start + size));
	}
	return out;
}

/** Bump SCHEMA when the shape or meaning of a cached TmdbMovie changes; old rows fall out of reach. */
const SCHEMA = 'v2';

export function cacheKey(name: string, year: number | null): string {
	return `${SCHEMA}::${name.trim().toLowerCase()}::${year ?? ''}`;
}

/** Returns the cached movie, null for a known (fresh) miss, or undefined if unknown. */
export async function getCached(
	db: D1Database,
	key: string
): Promise<TmdbMovie | null | undefined> {
	const hit = await db
		.prepare('SELECT data FROM movies WHERE cache_key = ?')
		.bind(key)
		.first<{ data: string }>();
	if (hit) return JSON.parse(hit.data) as TmdbMovie;
	const miss = await db
		.prepare('SELECT fetched_at FROM misses WHERE cache_key = ?')
		.bind(key)
		.first<{ fetched_at: number }>();
	if (miss && Date.now() - miss.fetched_at < MISS_TTL_MS) return null;
	return undefined;
}

export async function putCached(
	db: D1Database,
	key: string,
	movie: TmdbMovie | null
): Promise<void> {
	if (movie) {
		await db
			.prepare(
				'INSERT OR REPLACE INTO movies (cache_key, tmdb_id, data, fetched_at) VALUES (?, ?, ?, ?)'
			)
			.bind(key, movie.tmdbId, JSON.stringify(movie), Date.now())
			.run();
	} else {
		await db
			.prepare('INSERT OR REPLACE INTO misses (cache_key, fetched_at) VALUES (?, ?)')
			.bind(key, Date.now())
			.run();
	}
}

/**
 * Cache lookup for many keys in a couple of queries: hits map to the movie,
 * fresh misses to null, unknown keys are absent.
 */
export async function getCachedMany(
	db: D1Database,
	keys: string[]
): Promise<Map<string, TmdbMovie | null>> {
	const known = new Map<string, TmdbMovie | null>();
	for (const chunk of chunks(keys, MAX_PARAMS)) {
		const marks = chunk.map(() => '?').join(',');
		const { results } = await db
			.prepare(`SELECT cache_key, data FROM movies WHERE cache_key IN (${marks})`)
			.bind(...chunk)
			.all<{ cache_key: string; data: string }>();
		for (const row of results) known.set(row.cache_key, JSON.parse(row.data) as TmdbMovie);
	}

	const unknown = keys.filter((key) => !known.has(key));
	const cutoff = Date.now() - MISS_TTL_MS;
	for (const chunk of chunks(unknown, MAX_PARAMS - 1)) {
		const marks = chunk.map(() => '?').join(',');
		const { results } = await db
			.prepare(`SELECT cache_key FROM misses WHERE cache_key IN (${marks}) AND fetched_at > ?`)
			.bind(...chunk, cutoff)
			.all<{ cache_key: string }>();
		for (const row of results) known.set(row.cache_key, null);
	}
	return known;
}

/** Multi-row upserts so a whole batch costs a handful of D1 subrequests. */
export async function putCachedMany(
	db: D1Database,
	entries: [string, TmdbMovie | null][]
): Promise<void> {
	const now = Date.now();
	const movies = entries.filter((entry): entry is [string, TmdbMovie] => entry[1] !== null);
	const misses = entries.filter(([, movie]) => movie === null).map(([key]) => key);

	for (const chunk of chunks(movies, Math.floor(MAX_PARAMS / 4))) {
		const marks = chunk.map(() => '(?, ?, ?, ?)').join(',');
		await db
			.prepare(
				`INSERT OR REPLACE INTO movies (cache_key, tmdb_id, data, fetched_at) VALUES ${marks}`
			)
			.bind(...chunk.flatMap(([key, movie]) => [key, movie.tmdbId, JSON.stringify(movie), now]))
			.run();
	}
	for (const chunk of chunks(misses, Math.floor(MAX_PARAMS / 2))) {
		const marks = chunk.map(() => '(?, ?)').join(',');
		await db
			.prepare(`INSERT OR REPLACE INTO misses (cache_key, fetched_at) VALUES ${marks}`)
			.bind(...chunk.flatMap((key) => [key, now]))
			.run();
	}
}

export interface RelatedMovie {
	tmdbId: number;
	title: string;
	year: number | null;
	traktRating: number | null;
}

export async function getRelatedCached(
	db: D1Database,
	tmdbId: number
): Promise<RelatedMovie[] | undefined> {
	const hit = await db
		.prepare('SELECT data, fetched_at FROM trakt_related WHERE tmdb_id = ?')
		.bind(tmdbId)
		.first<{ data: string; fetched_at: number }>();
	if (!hit || Date.now() - hit.fetched_at >= RELATED_TTL_MS) return undefined;
	return JSON.parse(hit.data) as RelatedMovie[];
}

export async function putRelatedCached(
	db: D1Database,
	tmdbId: number,
	related: RelatedMovie[]
): Promise<void> {
	await db
		.prepare('INSERT OR REPLACE INTO trakt_related (tmdb_id, data, fetched_at) VALUES (?, ?, ?)')
		.bind(tmdbId, JSON.stringify(related), Date.now())
		.run();
}
