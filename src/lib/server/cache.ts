import type { D1Database } from '@cloudflare/workers-types';
import type { TmdbMovie } from '$lib/types';

const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RELATED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function cacheKey(name: string, year: number | null): string {
	return `${name.trim().toLowerCase()}::${year ?? ''}`;
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
