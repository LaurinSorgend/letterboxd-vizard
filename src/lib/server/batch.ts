import { error } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';
import pLimit, { type LimitFunction } from 'p-limit';
import { MAX_BATCH, type BatchAnswer } from '$lib/types';
import { FetchBudget, fetchesPerRequest, RetryLater } from './budget';
import type { Cache } from './cache';
import { getDb } from './db';

const CONCURRENCY = 5;

/** What one API request may spend: its cache, its upstream budget, and its concurrency. */
export interface RequestContext {
	db: D1Database;
	budget: FetchBudget;
	limit: LimitFunction;
}

/**
 * A fresh context per request: Workers cap subrequests per invocation and forbid I/O queued from
 * another request's context. `reserve` walls off part of the budget for a later phase.
 */
export async function requestContext(
	platform: App.Platform | undefined,
	reserve = 0
): Promise<RequestContext> {
	return {
		db: await getDb(platform),
		budget: new FetchBudget(fetchesPerRequest(), reserve),
		limit: pLimit(CONCURRENCY)
	};
}

export const isInteger = (value: unknown): value is number => Number.isInteger(value);

/**
 * The items under `field` of a batch request's JSON body, and the body for any other fields.
 * Answers 400 with `Expected body: <expected>` when the list is missing or holds an item that
 * fails `isItem`, and when it is longer than MAX_BATCH.
 */
export async function readBatch<T>(
	request: Request,
	field: string,
	isItem: (item: unknown) => item is T,
	expected: string
): Promise<{ items: T[]; body: Record<string, unknown> }> {
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const items = body?.[field];
	if (!body || !Array.isArray(items) || !items.every(isItem)) {
		error(400, `Expected body: ${expected}`);
	}
	if (items.length > MAX_BATCH) error(400, `Batch too large, send at most ${MAX_BATCH} items`);
	return { items, body };
}

export interface BatchLookup<T, K, V> {
	/** Cache key of a request item, or null for one the upstream cannot know. */
	keyOf: (item: T) => K | null;
	cache: Cache<K, V>;
	/** One upstream lookup; each call spends from the request's budget. */
	fetchOne: (budget: FetchBudget, item: T) => Promise<V>;
	/** Names a failed key in the server log. */
	label: string;
}

/**
 * Reads the cache for every item, fetches the rest within the request's budget, stores what came
 * back, and answers in request order. A lookup that may succeed later is pending; any other
 * failure is final and answers null, as does an item without a key.
 */
export async function resolveBatch<T, K, V>(
	items: T[],
	lookup: BatchLookup<T, K, V>,
	{ db, budget, limit }: RequestContext
): Promise<BatchAnswer<V>> {
	const keys = items.map(lookup.keyOf);
	const firstItem = new Map<K, T>();
	keys.forEach((key, index) => {
		if (key !== null && !firstItem.has(key)) firstItem.set(key, items[index]);
	});
	const known = await lookup.cache.getMany(db, [...firstItem.keys()]);
	const resolved = new Map<K, V>();
	const retry = new Set<K>();
	await Promise.all(
		[...firstItem]
			.filter(([key]) => !known.has(key))
			.map(async ([key, item]) => {
				try {
					resolved.set(key, await limit(() => lookup.fetchOne(budget, item)));
				} catch (cause) {
					if (cause instanceof RetryLater) retry.add(key);
					else console.error(`${lookup.label} failed: ${String(key)}`, cause);
				}
			})
	);
	if (resolved.size > 0) await lookup.cache.putMany(db, [...resolved]);

	const results = keys.map((key) =>
		key === null ? null : (known.get(key) ?? resolved.get(key) ?? null)
	);
	const pending = [...keys.entries()]
		.filter(([, key]) => key !== null && retry.has(key))
		.map(([index]) => index);
	return { results, pending };
}
