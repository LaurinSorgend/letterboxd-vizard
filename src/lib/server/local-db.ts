import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import schemaSql from '../../../schema.sql?raw';

const DB_PATH = process.env.CACHE_DB_PATH ?? 'data/cache.db';

let handle: Database.Database | undefined;

function open(): Database.Database {
	if (handle) return handle;
	fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
	const db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.exec(schemaSql);
	handle = db;
	return db;
}

/**
 * Minimal D1Database-compatible facade over better-sqlite3 so self-hosters get
 * the same cache without Cloudflare. Implements only the
 * prepare().bind().first()/run()/all() subset the app uses.
 */
export function localDb(): D1Database {
	const db = open();
	const prepare = (sql: string) => {
		const stmt = db.prepare(sql);
		const withArgs = (args: unknown[]) => ({
			first: async <T>() => (stmt.get(...args) as T | undefined) ?? null,
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
