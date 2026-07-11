import type { EnrichRequestItem, TmdbMovie } from '$lib/types';

const BATCH_SIZE = 50;
/** Batches in flight at once, so the server pipeline never drains between round trips. */
const MAX_IN_FLIGHT = 2;

async function enrichBatch(batch: EnrichRequestItem[]): Promise<(TmdbMovie | null)[]> {
	const response = await fetch('/api/enrich', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ items: batch.map((f) => ({ name: f.name, year: f.year })) })
	});
	if (!response.ok) {
		throw new Error(`Enrichment failed (${response.status}): ${await response.text()}`);
	}
	return ((await response.json()) as { results: (TmdbMovie | null)[] }).results;
}

/** Resolves name+year items against /api/enrich in batches, reporting progress after each batch. */
export async function enrichFilms<T extends EnrichRequestItem>(
	items: T[],
	onProgress: (done: number, total: number) => void
): Promise<(T & { tmdb: TmdbMovie | null })[]> {
	const batches: T[][] = [];
	for (let start = 0; start < items.length; start += BATCH_SIZE) {
		batches.push(items.slice(start, start + BATCH_SIZE));
	}

	const results: (TmdbMovie | null)[][] = new Array(batches.length);
	let done = 0;
	let next = 0;
	async function worker() {
		while (next < batches.length) {
			const index = next++;
			results[index] = await enrichBatch(batches[index]);
			done += batches[index].length;
			onProgress(done, items.length);
		}
	}
	await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, batches.length) }, worker));

	return items.map((item, i) => ({
		...item,
		tmdb: results[Math.floor(i / BATCH_SIZE)][i % BATCH_SIZE]
	}));
}
