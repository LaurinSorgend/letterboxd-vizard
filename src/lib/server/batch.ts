import pLimit from 'p-limit';
import { FetchBudget, FETCHES_PER_REQUEST, RetryLater } from './budget';

const CONCURRENCY = 5;

/** Most items one batch request may carry, on every batch endpoint. */
export const MAX_BATCH = 100;

export interface BatchLookup<T, K, V> {
	/** Cache key of a request item, or null for one the upstream cannot know. */
	keyOf: (item: T) => K | null;
	/** Cached values for the keys, stale and unknown ones left out. */
	getCached: (keys: K[]) => Promise<Map<K, V>>;
	/** One upstream lookup; each call spends from the shared per-request budget. */
	fetchOne: (budget: FetchBudget, item: T) => Promise<V>;
	putCached: (entries: [K, V][]) => Promise<void>;
	/** Names a failed key in the server log. */
	label: string;
}

export interface BatchAnswer<V> {
	results: (V | null)[];
	/** Indices of the request the client should send again. */
	pending: number[];
}

/**
 * Reads the cache for every item, fetches the rest under one fetch budget, stores what came back,
 * and answers in request order. A lookup that may succeed later is pending; any other failure is
 * final and answers null, as does an item without a key.
 */
export async function resolveBatch<T, K, V>(
	items: T[],
	lookup: BatchLookup<T, K, V>
): Promise<BatchAnswer<V>> {
	const keys = items.map(lookup.keyOf);
	const firstItem = new Map<K, T>();
	keys.forEach((key, index) => {
		if (key !== null && !firstItem.has(key)) firstItem.set(key, items[index]);
	});
	const known = await lookup.getCached([...firstItem.keys()]);
	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const limit = pLimit(CONCURRENCY);
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
	if (resolved.size > 0) await lookup.putCached([...resolved]);

	const results = keys.map((key) =>
		key === null ? null : (known.get(key) ?? resolved.get(key) ?? null)
	);
	const pending = [...keys.entries()]
		.filter(([, key]) => key !== null && retry.has(key))
		.map(([index]) => index);
	return { results, pending };
}
