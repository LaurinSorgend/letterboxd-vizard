import type { EnrichRequestItem, OmdbRatings, TmdbMovie } from '$lib/types';

const BATCH_SIZE = 50;
/** Retry batches stay under the server's per-request fetch budget (~2 fetches per film). */
const RETRY_BATCH_SIZE = 15;
/** Batches in flight at once, so the server pipeline never drains between round trips. */
const MAX_IN_FLIGHT = 2;
/** Rounds of retries for lookups the server deferred (fetch budget) or failed transiently. */
const MAX_ROUNDS = 8;

interface EnrichResponse {
	results: (TmdbMovie | null)[];
	pending?: number[];
}

async function enrichBatch(batch: EnrichRequestItem[]): Promise<EnrichResponse> {
	const response = await fetch('/api/enrich', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ items: batch.map((f) => ({ name: f.name, year: f.year })) })
	});
	if (!response.ok) {
		throw new Error(`Enrichment failed (${response.status}): ${await response.text()}`);
	}
	return (await response.json()) as EnrichResponse;
}

/** Resolves name+year items against /api/enrich in batches, reporting progress after each batch. */
export async function enrichFilms<T extends EnrichRequestItem>(
	items: T[],
	onProgress: (done: number, total: number) => void
): Promise<(T & { tmdb: TmdbMovie | null })[]> {
	const tmdb: (TmdbMovie | null)[] = new Array(items.length).fill(null);
	let queue = items.map((_, index) => index);
	let done = 0;

	for (let round = 0; round < MAX_ROUNDS && queue.length > 0; round++) {
		const size = round === 0 ? BATCH_SIZE : RETRY_BATCH_SIZE;
		const batches: number[][] = [];
		for (let start = 0; start < queue.length; start += size) {
			batches.push(queue.slice(start, start + size));
		}

		const retry: number[] = [];
		let next = 0;
		async function worker() {
			while (next < batches.length) {
				const batch = batches[next++];
				try {
					const { results, pending } = await enrichBatch(batch.map((i) => items[i]));
					const stillPending = new Set(pending ?? []);
					batch.forEach((itemIndex, batchIndex) => {
						if (stillPending.has(batchIndex)) {
							retry.push(itemIndex);
						} else {
							tmdb[itemIndex] = results[batchIndex];
							done += 1;
						}
					});
				} catch {
					// A failed HTTP/network batch is retried next round rather than discarding the whole library.
					retry.push(...batch);
				}
				onProgress(done, items.length);
			}
		}
		await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, batches.length) }, worker));
		queue = retry;
	}

	return items.map((item, i) => ({ ...item, tmdb: tmdb[i] }));
}

interface OmdbEnrichResponse {
	results: (OmdbRatings | null)[];
	pending?: number[];
}

async function enrichOmdbBatch(batch: string[]): Promise<OmdbEnrichResponse> {
	const response = await fetch('/api/omdb-enrich', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ imdbIds: batch })
	});
	if (!response.ok) {
		throw new Error(`OMDb enrichment failed (${response.status}): ${await response.text()}`);
	}
	return (await response.json()) as OmdbEnrichResponse;
}

/** Resolves IMDb ids against /api/omdb-enrich in batches; a 404/unset key resolves every id to null. */
export async function enrichOmdb(
	imdbIds: string[],
	onProgress: (done: number, total: number) => void
): Promise<Map<string, OmdbRatings | null>> {
	const unique = [...new Set(imdbIds)];
	const ratings = new Map<string, OmdbRatings | null>();
	let queue = unique.map((_, index) => index);
	let done = 0;

	for (let round = 0; round < MAX_ROUNDS && queue.length > 0; round++) {
		const size = round === 0 ? BATCH_SIZE : RETRY_BATCH_SIZE;
		const batches: number[][] = [];
		for (let start = 0; start < queue.length; start += size) {
			batches.push(queue.slice(start, start + size));
		}

		const retry: number[] = [];
		let next = 0;
		async function worker() {
			while (next < batches.length) {
				const batch = batches[next++];
				try {
					const { results, pending } = await enrichOmdbBatch(batch.map((i) => unique[i]));
					const stillPending = new Set(pending ?? []);
					batch.forEach((itemIndex, batchIndex) => {
						if (stillPending.has(batchIndex)) {
							retry.push(itemIndex);
						} else {
							ratings.set(unique[itemIndex], results[batchIndex]);
							done += 1;
						}
					});
				} catch {
					retry.push(...batch);
				}
				onProgress(done, unique.length);
			}
		}
		await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, batches.length) }, worker));
		queue = retry;
	}

	return ratings;
}
