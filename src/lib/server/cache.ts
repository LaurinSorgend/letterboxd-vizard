import Database from 'better-sqlite3';
import fs from 'node:fs';
import type { TmdbMovie } from '$lib/types';

const DATA_DIR = 'data';
const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SCHEMA_VERSION = 2;

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(`${DATA_DIR}/cache.db`);
db.pragma('journal_mode = WAL');
if ((db.pragma('user_version', { simple: true }) as number) < SCHEMA_VERSION) {
	db.exec('DROP TABLE IF EXISTS movies; DROP TABLE IF EXISTS misses;');
	db.pragma(`user_version = ${SCHEMA_VERSION}`);
}
db.exec(`
	CREATE TABLE IF NOT EXISTS movies (
		cache_key TEXT PRIMARY KEY,
		tmdb_id INTEGER NOT NULL,
		data TEXT NOT NULL,
		fetched_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS misses (
		cache_key TEXT PRIMARY KEY,
		fetched_at INTEGER NOT NULL
	);
`);

const selectMovie = db.prepare('SELECT data FROM movies WHERE cache_key = ?');
const insertMovie = db.prepare(
	'INSERT OR REPLACE INTO movies (cache_key, tmdb_id, data, fetched_at) VALUES (?, ?, ?, ?)'
);
const selectMiss = db.prepare('SELECT fetched_at FROM misses WHERE cache_key = ?');
const insertMiss = db.prepare('INSERT OR REPLACE INTO misses (cache_key, fetched_at) VALUES (?, ?)');

export function cacheKey(name: string, year: number | null): string {
	return `${name.trim().toLowerCase()}::${year ?? ''}`;
}

/** Returns the cached movie, null for a known (fresh) miss, or undefined if unknown. */
export function getCached(key: string): TmdbMovie | null | undefined {
	const hit = selectMovie.get(key) as { data: string } | undefined;
	if (hit) return JSON.parse(hit.data) as TmdbMovie;
	const miss = selectMiss.get(key) as { fetched_at: number } | undefined;
	if (miss && Date.now() - miss.fetched_at < MISS_TTL_MS) return null;
	return undefined;
}

export function putCached(key: string, movie: TmdbMovie | null): void {
	if (movie) insertMovie.run(key, movie.tmdbId, JSON.stringify(movie), Date.now());
	else insertMiss.run(key, Date.now());
}
