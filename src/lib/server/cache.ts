import type { D1Database } from '@cloudflare/workers-types';
import type { TmdbMovie } from '$lib/types';
import type { FetchBudget } from './budget';

const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** TMDB's recommendations shift slowly, so a related list stays useful far longer than a week. */
const RELATED_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** D1 allows at most 100 bound parameters per query. */
const MAX_PARAMS = 100;

function chunks<T>(list: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let start = 0; start < list.length; start += size) {
		out.push(list.slice(start, start + size));
	}
	return out;
}

/**
 * Bump SCHEMA when the shape or meaning of a cached TmdbMovie changes. Keys are built before
 * the media type is known, so a bump invalidates every record, when only one kind of record
 * changed, a targeted delete costs a great deal less than the re-warm a bump forces.
 */
const SCHEMA = 'v5';

export function cacheKey(name: string, year: number | null): string {
	return `${SCHEMA}::${name.trim().toLowerCase()}::${year ?? ''}`;
}

let swept = false;

/**
 * Drops rows left behind by superseded SCHEMA generations. Nothing else ever deletes, so
 * without this a bump strands its whole generation in the database permanently. Runs once
 * per isolate off the batch read that precedes any warm.
 */
async function sweepOldGenerations(db: D1Database): Promise<void> {
	if (swept) return;
	swept = true;
	const current = `${SCHEMA}::%`;
	for (const table of ['movies', 'misses']) {
		await db.prepare(`DELETE FROM ${table} WHERE cache_key NOT LIKE ?`).bind(current).run();
	}
}

/**
 * Returns the cached movie, null for a known (fresh) miss, or undefined if unknown. Each of the
 * two lookups is a subrequest; when `budget` has none left it stops and reports the key unknown.
 */
export async function getCached(
	db: D1Database,
	key: string,
	budget?: FetchBudget
): Promise<TmdbMovie | null | undefined> {
	if (budget && !budget.tryTake()) return undefined;
	const hit = await db
		.prepare('SELECT data FROM movies WHERE cache_key = ?')
		.bind(key)
		.first<{ data: string }>();
	if (hit) return JSON.parse(hit.data) as TmdbMovie;
	if (budget && !budget.tryTake()) return undefined;
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
	movie: TmdbMovie | null,
	budget?: FetchBudget
): Promise<void> {
	if (budget && !budget.tryTake()) return;
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
	await sweepOldGenerations(db);
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
	rating: number | null;
	posterPath: string | null;
}

/**
 * Related lists for many seeds in a query or two, off-budget like `getCachedMany`: a warm seed
 * phase then costs one subrequest rather than one per seed. Stale and unknown seeds are absent.
 */
export async function getRelatedCachedMany(
	db: D1Database,
	tmdbIds: number[]
): Promise<Map<number, RelatedMovie[]>> {
	const known = new Map<number, RelatedMovie[]>();
	const cutoff = Date.now() - RELATED_TTL_MS;
	for (const chunk of chunks(tmdbIds, MAX_PARAMS - 1)) {
		const marks = chunk.map(() => '?').join(',');
		const { results } = await db
			.prepare(`SELECT tmdb_id, data FROM related WHERE tmdb_id IN (${marks}) AND fetched_at > ?`)
			.bind(...chunk, cutoff)
			.all<{ tmdb_id: number; data: string }>();
		for (const row of results) known.set(row.tmdb_id, JSON.parse(row.data) as RelatedMovie[]);
	}
	return known;
}

/** Multi-row upsert so a cold seed phase spends a couple of subrequests, not one per seed. */
export async function putRelatedCachedMany(
	db: D1Database,
	entries: [number, RelatedMovie[]][]
): Promise<void> {
	const now = Date.now();
	for (const chunk of chunks(entries, Math.floor(MAX_PARAMS / 3))) {
		const marks = chunk.map(() => '(?, ?, ?)').join(',');
		await db
			.prepare(`INSERT OR REPLACE INTO related (tmdb_id, data, fetched_at) VALUES ${marks}`)
			.bind(...chunk.flatMap(([tmdbId, related]) => [tmdbId, JSON.stringify(related), now]))
			.run();
	}
}
