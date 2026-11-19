import { DEFAULT_FETCH_BUDGET, MAX_BATCH, type BatchAnswer } from '$lib/types';
import { postJson } from './http';

/** A batch over MAX_BATCH is refused outright, round after round. */
const capped = (size: number): number => Math.min(size, MAX_BATCH);

/** Subrequests a sized batch leaves unspent under the server's default fetch budget. */
const HEADROOM = 5;
/**
 * First round of /api/enrich, which spends about two subrequests per uncached film. Most of a
 * returning library is cached, so the first round sends more than a cold batch could fetch; the
 * server defers the rest into the retry rounds.
 */
const BATCH_SIZE = capped(DEFAULT_FETCH_BUDGET + 2 * HEADROOM);
/** Endpoints that spend one subrequest per uncached item: a full batch fits the budget. */
const ONE_FETCH_PER_ITEM_BATCH_SIZE = capped(DEFAULT_FETCH_BUDGET - HEADROOM);
/** Retry batches of /api/enrich fit the budget at about two subrequests per film. */
const RETRY_BATCH_SIZE = capped(DEFAULT_FETCH_BUDGET / 2 - HEADROOM);
/** Batches in flight at once, so the server pipeline never drains between round trips. */
const MAX_IN_FLIGHT = 2;
/** Rounds of retries for lookups the server deferred (fetch budget) or failed transiently. */
const MAX_ROUNDS = 8;
/** Pause before retry round n is n times this, so a rate-limited server is not hammered. */
const ROUND_DELAY_MS = 300;

function pause(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal?.aborted) return resolve();
		const timer = setTimeout(done, ms);
		signal?.addEventListener('abort', done, { once: true });
		function done() {
			clearTimeout(timer);
			signal?.removeEventListener('abort', done);
			resolve();
		}
	});
}

interface RoundsOptions<T, R> {
	items: T[];
	send: (batch: T[]) => Promise<BatchAnswer<R>>;
	/** Called once per resolved item, in whatever order the batches come back. */
	keep: (index: number, result: R | null) => void;
	onProgress?: (done: number, total: number) => void;
	firstRoundSize?: number;
	/** Stops sending further batches once aborted; the items left never reach `keep`. */
	signal?: AbortSignal;
}

/**
 * Runs a batched lookup to completion: chunks the queue, keeps `MAX_IN_FLIGHT` batches in
 * the air, and re-queues whatever the server deferred under its fetch budget or a failed
 * request left behind, so a large library still resolves in one visit. Items still unresolved
 * when the rounds run out never reach `keep`.
 */
export async function runRounds<T, R>({
	items,
	send,
	keep,
	onProgress,
	firstRoundSize = BATCH_SIZE,
	signal
}: RoundsOptions<T, R>): Promise<void> {
	let queue = items.map((_, index) => index);
	let done = 0;

	for (let round = 0; round < MAX_ROUNDS && queue.length > 0 && !signal?.aborted; round++) {
		if (round > 0) await pause(round * ROUND_DELAY_MS, signal);
		const size = round === 0 ? firstRoundSize : RETRY_BATCH_SIZE;
		const batches: number[][] = [];
		for (let start = 0; start < queue.length; start += size) {
			batches.push(queue.slice(start, start + size));
		}

		const retry: number[] = [];
		let next = 0;
		const worker = async () => {
			while (next < batches.length && !signal?.aborted) {
				const batch = batches[next++];
				try {
					const { results, pending } = await send(batch.map((i) => items[i]));
					const stillPending = new Set(pending ?? []);
					batch.forEach((itemIndex, batchIndex) => {
						if (stillPending.has(batchIndex)) {
							retry.push(itemIndex);
							return;
						}
						keep(itemIndex, results[batchIndex]);
						done += 1;
					});
				} catch {
					retry.push(...batch);
				}
				onProgress?.(done, items.length);
			}
		};
		await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, batches.length) }, worker));
		queue = retry;
	}
}

/** A batched server lookup: answers the items it could resolve, by key, and leaves the rest out. */
export type Fetcher<T, K, V> = (
	items: T[],
	onProgress?: (done: number, total: number) => void,
	signal?: AbortSignal
) => Promise<Map<K, V>>;

interface BatchEndpoint<T, K> {
	url: string;
	/** Names the lookup in errors. */
	label: string;
	body: (batch: T[]) => unknown;
	keyOf: (item: T) => K;
}

/**
 * A fetcher for an endpoint that spends one subrequest per uncached item. Each answer is keyed by
 * `keyOf`; null means the upstream has none.
 */
export function batchFetcher<T, K, V>({
	url,
	label,
	body,
	keyOf
}: BatchEndpoint<T, K>): Fetcher<T, K, V | null> {
	return async (items, onProgress, signal) => {
		const found = new Map<K, V | null>();
		await runRounds<T, V>({
			items,
			send: (batch) => postJson<BatchAnswer<V>>(url, body(batch), label, signal),
			keep: (index, value) => found.set(keyOf(items[index]), value),
			onProgress,
			firstRoundSize: ONE_FETCH_PER_ITEM_BATCH_SIZE,
			signal
		});
		return found;
	};
}
