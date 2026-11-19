import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import schemaSql from '../../../schema.sql?raw';

let handle: D1Database | undefined;

/**
 * Minimal D1Database-compatible facade over better-sqlite3, with schema.sql applied, so
 * self-hosters get the same cache without Cloudflare. Implements only the
 * prepare().bind().run()/all() subset the app uses.
 */
export function d1Facade(db: Database.Database): D1Database {
	db.exec(schemaSql);
	const prepare = (sql: string) => {
		const stmt = db.prepare(sql);
		const withArgs = (args: unknown[]) => ({
			run: async () => {
				stmt.run(...args);
				return { success: true, meta: {} };
			},
			all: async <T>() => ({ results: stmt.all(...args) as T[], success: true, meta: {} }),
			bind: (...next: unknown[]) => withArgs(next)
		});
		return withArgs([]);
	};
	return { prepare } as unknown as D1Database;
}

/** The cache database at CACHE_DB_PATH, created with schema.sql on first open. */
export function localDb(): D1Database {
	if (handle) return handle;
	const file = env.CACHE_DB_PATH || 'data/cache.db';
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = new Database(file);
	db.pragma('journal_mode = WAL');
	handle = d1Facade(db);
	return handle;
}
