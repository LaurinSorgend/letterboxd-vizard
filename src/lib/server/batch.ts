import pLimit from 'p-limit';
import { BudgetExhausted, FetchBudget, FETCHES_PER_REQUEST } from './budget';

const CONCURRENCY = 5;

export interface BatchLookup<K, V> {
	/** Cached values for the keys, stale and unknown ones left out. */
	getCached: (keys: K[]) => Promise<Map<K, V>>;
	/** One upstream lookup; each call spends from the shared per-request budget. */
	fetchOne: (budget: FetchBudget, key: K) => Promise<V>;
	putCached: (entries: [K, V][]) => Promise<void>;
	/** Whether a failed lookup is answered as pending (retried by the client) rather than null. */
	retryFailures: boolean;
	/** Names a failed key in the server log. */
	label: string;
}

export interface BatchAnswer<V> {
	results: (V | null)[];
	/** Indices of the request the client should send again. */
	pending: number[];
}

/**
 * The cache-then-fetch flow every batch endpoint shares: reads the cache for all keys, fetches the
 * rest under one fetch budget, stores what came back, and answers in request order. A null key is
 * one the upstream cannot know and always answers null.
 */
export async function resolveBatch<K, V>(
	keys: (K | null)[],
	lookup: BatchLookup<K, V>
): Promise<BatchAnswer<V>> {
	const wanted = [...new Set(keys.filter((key): key is K => key !== null))];
	const known = await lookup.getCached(wanted);
	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const limit = pLimit(CONCURRENCY);
	const resolved = new Map<K, V>();
	const retry = new Set<K>();
	await Promise.all(
		wanted
			.filter((key) => !known.has(key))
			.map(async (key) => {
				try {
					resolved.set(key, await limit(() => lookup.fetchOne(budget, key)));
				} catch (cause) {
					const deferred = cause instanceof BudgetExhausted;
					if (!deferred) console.error(`${lookup.label} failed: ${String(key)}`, cause);
					if (deferred || lookup.retryFailures) retry.add(key);
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

/** TMDB ids are positive; the app stores TheTVDB records under negative ids. */
export const isTmdbId = (id: number): boolean => id > 0;
