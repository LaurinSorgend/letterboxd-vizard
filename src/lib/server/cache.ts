import type { D1Database } from '@cloudflare/workers-types';

/** D1 allows at most 100 bound parameters per query. */
const MAX_PARAMS = 100;

/**
 * Values stored by key in D1. Reads and writes go a chunk of keys at a time, so a whole batch costs
 * a few queries rather than one per key; they are not counted against the fetch budget.
 */
export interface Cache<K, V> {
	/** The fresh values stored for `keys`; stale and unknown keys are absent. */
	getMany(db: D1Database, keys: K[]): Promise<Map<K, V>>;
	putMany(db: D1Database, entries: [K, V][]): Promise<void>;
}

interface Table {
	/** A table from schema.sql, with `key`, `data` and `fetched_at` columns. */
	table: string;
	key: string;
	/**
	 * Generation of what the table stores. Keys are stored under it, and on first use in an
	 * isolate rows of any other generation are deleted, since nothing else ever deletes them.
	 * Only for text keys.
	 */
	version?: string;
}

/** Every table a cache was declared on, for the test that holds them against schema.sql. */
export const declaredTables = new Map<string, string[]>();

function declare(table: string, columns: string[]): void {
	declaredTables.set(table, columns);
}

function chunks<T>(list: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let start = 0; start < list.length; start += size) out.push(list.slice(start, start + size));
	return out;
}

/** The rows among `keys` written after `since`, a chunk of keys per query. */
async function selectIn<Row>(
	db: D1Database,
	table: string,
	columns: string[],
	keys: unknown[],
	since: number
): Promise<Row[]> {
	const [key] = columns;
	const rows: Row[] = [];
	// One parameter of each query goes to `since`.
	for (const chunk of chunks(keys, MAX_PARAMS - 1)) {
		const marks = chunk.map(() => '?').join(',');
		const { results } = await db
			.prepare(
				`SELECT ${columns.join(', ')} FROM ${table} WHERE ${key} IN (${marks}) AND fetched_at > ?`
			)
			.bind(...chunk, since)
			.all<Row>();
		rows.push(...results);
	}
	return rows;
}

/** Multi-row upserts, as many rows per query as the parameter limit allows. */
async function insertRows(
	db: D1Database,
	table: string,
	columns: string[],
	rows: unknown[][]
): Promise<void> {
	const row = `(${columns.map(() => '?').join(', ')})`;
	for (const chunk of chunks(rows, Math.floor(MAX_PARAMS / columns.length))) {
		await db
			.prepare(
				`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => row).join(',')}`
			)
			.bind(...chunk.flat())
			.run();
	}
}

const swept = new Set<string>();

async function sweep(db: D1Database, table: string, key: string, version: string): Promise<void> {
	if (swept.has(table)) return;
	swept.add(table);
	await db.prepare(`DELETE FROM ${table} WHERE ${key} NOT LIKE ?`).bind(`${version}:%`).run();
}

/** Stores keys under the table's version, and maps stored keys back to the asked ones. */
function versioned<K>(version: string | undefined) {
	const store = (key: K): unknown => (version === undefined ? key : `${version}:${key}`);
	return { store, byStored: (keys: K[]) => new Map(keys.map((key) => [store(key), key])) };
}

const since = (ttlMs: number): number => (Number.isFinite(ttlMs) ? Date.now() - ttlMs : 0);

/**
 * A JSON value per key, fresh for `ttlMs` (forever when unset). A null value is not stored: the
 * key stays unknown and is looked up again next time.
 */
export function jsonCache<K extends string | number, V>({
	table,
	key,
	version,
	ttlMs = Infinity
}: Table & { ttlMs?: number }): Cache<K, V> {
	const columns = [key, 'data', 'fetched_at'];
	declare(table, columns);
	const keys = versioned<K>(version);
	return {
		async getMany(db, wanted) {
			if (version !== undefined) await sweep(db, table, key, version);
			const original = keys.byStored(wanted);
			const rows = await selectIn<Record<string, unknown>>(
				db,
				table,
				[key, 'data'],
				[...original.keys()],
				since(ttlMs)
			);
			return new Map(
				rows.map((row) => [original.get(row[key]) as K, JSON.parse(row.data as string) as V])
			);
		},
		async putMany(db, entries) {
			const now = Date.now();
			const rows = entries
				.filter(([, value]) => value !== null)
				.map(([id, value]) => [keys.store(id), JSON.stringify(value), now]);
			await insertRows(db, table, columns, rows);
		}
	};
}

/**
 * A JSON value per key, kept for good, plus remembered misses (null) that are looked up again
 * once `missTtlMs` has passed: an upstream that found nothing may know the key later.
 */
export function hitMissCache<K extends string, V>({
	table,
	missTable,
	key,
	version,
	missTtlMs
}: Table & { missTable: string; missTtlMs: number }): Cache<K, V | null> {
	const hits = jsonCache<K, V | null>({ table, key, version });
	const missColumns = [key, 'fetched_at'];
	declare(missTable, missColumns);
	const keys = versioned<K>(version);
	return {
		async getMany(db, wanted) {
			const known = await hits.getMany(db, wanted);
			if (version !== undefined) await sweep(db, missTable, key, version);
			const original = keys.byStored(wanted.filter((id) => !known.has(id)));
			const misses = await selectIn<Record<string, unknown>>(
				db,
				missTable,
				[key],
				[...original.keys()],
				since(missTtlMs)
			);
			for (const row of misses) known.set(original.get(row[key]) as K, null);
			return known;
		},
		async putMany(db, entries) {
			await hits.putMany(db, entries);
			const now = Date.now();
			const misses = entries.filter(([, value]) => value === null);
			await insertRows(
				db,
				missTable,
				missColumns,
				misses.map(([id]) => [keys.store(id), now])
			);
		}
	};
}
