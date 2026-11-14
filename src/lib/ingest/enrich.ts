import type {
	CollectionParts,
	EnrichRequestItem,
	OmdbRatings,
	ProviderRequestItem,
	RegionOffers,
	TmdbMovie
} from '$lib/types';
import type { FilmReleases } from '$lib/releases/dates';
import { offersKey } from '$lib/types';

const BATCH_SIZE = 50;
/**
 * Collections and providers spend one subrequest per uncached id, so a full 50 would always overrun the
 * server's per-request fetch budget and defer the tail into a retry round.
 */
const COLLECTIONS_BATCH_SIZE = 35;
/** Retry batches stay under the server's per-request fetch budget (~2 fetches per film). */
const RETRY_BATCH_SIZE = 15;
/** Batches in flight at once, so the server pipeline never drains between round trips. */
const MAX_IN_FLIGHT = 2;
/** Rounds of retries for lookups the server deferred (fetch budget) or failed transiently. */
const MAX_ROUNDS = 8;

/** Every batch endpoint answers with one result per item plus the indices it deferred. */
interface BatchResponse<R> {
	results: (R | null)[];
	pending?: number[];
}

async function postBatch<R>(
	url: string,
	body: unknown,
	label: string,
	signal?: AbortSignal
): Promise<BatchResponse<R>> {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal
	});
	if (!response.ok) {
		throw new Error(`${label} failed (${response.status}): ${await response.text()}`);
	}
	return (await response.json()) as BatchResponse<R>;
}

interface RoundsOptions<T, R> {
	items: T[];
	send: (batch: T[]) => Promise<BatchResponse<R>>;
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
async function runRounds<T, R>({
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
					// A failed HTTP/network batch is retried next round rather than discarding the rest.
					retry.push(...batch);
				}
				onProgress?.(done, items.length);
			}
		};
		await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, batches.length) }, worker));
		queue = retry;
	}
}

/** Resolves name+year items against /api/enrich in batches, reporting progress after each batch. */
export async function enrichFilms<T extends EnrichRequestItem>(
	items: T[],
	onProgress: (done: number, total: number) => void
): Promise<(T & { tmdb: TmdbMovie | null })[]> {
	const tmdb: (TmdbMovie | null)[] = new Array(items.length).fill(null);

	await runRounds<T, TmdbMovie>({
		items,
		send: (batch) =>
			postBatch(
				'/api/enrich',
				{ items: batch.map((f) => ({ name: f.name, year: f.year })) },
				'Enrichment'
			),
		keep: (index, movie) => {
			tmdb[index] = movie;
		},
		onProgress
	});

	return items.map((item, i) => ({ ...item, tmdb: tmdb[i] }));
}

/** Resolves IMDb ids against /api/omdb-enrich in batches; a 404/unset key resolves every id to null. */
export async function enrichOmdb(
	imdbIds: string[],
	onProgress: (done: number, total: number) => void
): Promise<Map<string, OmdbRatings | null>> {
	const unique = [...new Set(imdbIds)];
	const ratings = new Map<string, OmdbRatings | null>();

	await runRounds<string, OmdbRatings>({
		items: unique,
		send: (batch) => postBatch('/api/omdb-enrich', { imdbIds: batch }, 'OMDb enrichment'),
		keep: (index, rating) => ratings.set(unique[index], rating),
		onProgress
	});

	return ratings;
}

/**
 * Where each title can be watched in `region`, keyed by `offersKey`; null means offered nowhere.
 * Titles the rounds could not reach are absent.
 */
export async function fetchProviders(
	items: ProviderRequestItem[],
	region: string,
	onProgress?: (done: number) => void,
	signal?: AbortSignal
): Promise<Map<string, RegionOffers | null>> {
	const offers = new Map<string, RegionOffers | null>();
	await runRounds<ProviderRequestItem, RegionOffers>({
		items,
		send: (batch) =>
			postBatch('/api/providers', { region, items: batch }, 'Provider lookup', signal),
		keep: (index, found) => offers.set(offersKey(items[index]), found),
		onProgress,
		firstRoundSize: COLLECTIONS_BATCH_SIZE,
		signal
	});
	return offers;
}

/**
 * Release dates of each movie in every country, keyed by TMDB id; null means TMDB has none.
 * Films the rounds could not reach are absent.
 */
export async function fetchReleaseDates(
	ids: number[],
	onProgress?: (done: number) => void,
	signal?: AbortSignal
): Promise<Map<number, FilmReleases | null>> {
	const releases = new Map<number, FilmReleases | null>();
	await runRounds<number, FilmReleases>({
		items: ids,
		send: (batch) => postBatch('/api/releases', { ids: batch }, 'Release date lookup', signal),
		keep: (index, found) => releases.set(ids[index], found),
		onProgress,
		firstRoundSize: COLLECTIONS_BATCH_SIZE,
		signal
	});
	return releases;
}

/** Collection sizes for the franchises in a library, keeping only ids TMDB knows a collection for. */
export async function fetchCollections(ids: number[]): Promise<CollectionParts[]> {
	const unique = [...new Set(ids)];
	const found: CollectionParts[] = [];

	await runRounds<number, CollectionParts>({
		items: unique,
		send: (batch) => postBatch('/api/collections', { ids: batch }, 'Collection lookup'),
		keep: (_index, parts) => {
			if (parts) found.push(parts);
		},
		firstRoundSize: COLLECTIONS_BATCH_SIZE
	});

	return found;
}
