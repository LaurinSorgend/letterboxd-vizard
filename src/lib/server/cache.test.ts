import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { declaredTables, hitMissCache, jsonCache } from './cache';
import { d1Facade } from './local-db';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

// Every server module, so each one declares its caches.
import.meta.glob(['./*.ts', '!./*.test.ts', '!./local-db*.ts'], { eager: true });

/** Columns per table created in schema.sql. */
function schemaTables(): Map<string, string[]> {
	const sql = readFileSync('schema.sql', 'utf8');
	const tables = new Map<string, string[]>();
	for (const [, name, body] of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([^;]*)\);/g)) {
		tables.set(
			name,
			body.split(',').map((line) => line.trim().split(/\s+/)[0])
		);
	}
	return tables;
}

const freshDb = () => d1Facade(new Database(':memory:'));

afterEach(() => {
	vi.useRealTimers();
});

describe('cache tables', () => {
	it('are the tables schema.sql creates, with every column the code reads and writes', () => {
		const schema = schemaTables();
		expect([...declaredTables.keys()].sort()).toEqual([...schema.keys()].sort());
		for (const [table, columns] of declaredTables) {
			expect(schema.get(table), table).toEqual(expect.arrayContaining(columns));
		}
	});
});

describe('jsonCache', () => {
	it('answers stored values for many keys at once, unknown and null ones absent', async () => {
		const db = freshDb();
		const cache = jsonCache<number, { n: number } | null>({ table: 'releases', key: 'tmdb_id' });
		const ids = Array.from({ length: 250 }, (_, i) => i + 1);
		await cache.putMany(db, [
			...ids.map((id): [number, { n: number }] => [id, { n: id }]),
			[999, null]
		]);
		const found = await cache.getMany(db, [...ids, 999, 1000]);
		expect(found.size).toBe(250);
		expect(found.get(250)).toEqual({ n: 250 });
		expect(found.has(999)).toBe(false);
	});

	it('leaves out values older than its ttl', async () => {
		vi.useFakeTimers({ now: 0, toFake: ['Date'] });
		const db = freshDb();
		const cache = jsonCache<string, string>({ table: 'upcoming', key: 'cache_key', ttlMs: 1000 });
		vi.setSystemTime(10);
		await cache.putMany(db, [['GB', 'stored']]);
		vi.setSystemTime(500);
		expect(await cache.getMany(db, ['GB'])).toEqual(new Map([['GB', 'stored']]));
		vi.setSystemTime(2000);
		expect(await cache.getMany(db, ['GB'])).toEqual(new Map());
	});

	it('does not answer values stored under another version', async () => {
		const db = freshDb();
		const table = { table: 'tmdb_records', key: 'record_key' };
		await jsonCache<string, string>({ ...table, version: 'old' }).putMany(db, [['movie:1', 'old']]);
		const current = jsonCache<string, string>({ ...table, version: 'new' });
		expect(await current.getMany(db, ['movie:1'])).toEqual(new Map());
		await current.putMany(db, [['movie:1', 'new']]);
		expect(await current.getMany(db, ['movie:1'])).toEqual(new Map([['movie:1', 'new']]));
	});
});

describe('hitMissCache', () => {
	it('keeps hits for good and remembers misses until their ttl passes', async () => {
		vi.useFakeTimers({ now: 1, toFake: ['Date'] });
		const db = freshDb();
		const cache = hitMissCache<string, number>({
			table: 'omdb',
			missTable: 'omdb_misses',
			key: 'imdb_id',
			missTtlMs: 1000
		});
		await cache.putMany(db, [
			['tt1', 7],
			['tt2', null]
		]);
		expect(await cache.getMany(db, ['tt1', 'tt2', 'tt3'])).toEqual(
			new Map([
				['tt1', 7],
				['tt2', null]
			])
		);
		vi.setSystemTime(5000);
		expect(await cache.getMany(db, ['tt1', 'tt2'])).toEqual(new Map([['tt1', 7]]));
	});
});
