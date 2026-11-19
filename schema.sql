-- Cache tables, each declared in code next to the fetcher that fills it (see src/lib/server).
-- D1 does not apply this file by itself: run it with `wrangler d1 execute` after adding a table.
CREATE TABLE IF NOT EXISTS matches (
	cache_key TEXT PRIMARY KEY,
	data TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS misses (
	cache_key TEXT PRIMARY KEY,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tmdb_records (
	record_key TEXT PRIMARY KEY,
	data TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS related (
	tmdb_id INTEGER PRIMARY KEY,
	data TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collections (
	collection_id INTEGER PRIMARY KEY,
	data TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS omdb (
	imdb_id TEXT PRIMARY KEY,
	data TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS omdb_misses (
	imdb_id TEXT PRIMARY KEY,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS providers (
	media_key TEXT PRIMARY KEY,
	data TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS releases (
	tmdb_id INTEGER PRIMARY KEY,
	data TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS upcoming (
	cache_key TEXT PRIMARY KEY,
	data TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
);
-- One-time migration (2026-11): records moved from `movies` (by name and year) and `records`
-- (movies by id) into `matches` and `tmdb_records`. Delete once deployed databases have run it.
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS records;
