import type { EnrichedFilm, Film, TmdbMovie } from '$lib/types';

const BATCH_SIZE = 50;
/** Batches in flight at once, so the server pipeline never drains between round trips. */
const MAX_IN_FLIGHT = 2;

async function enrichBatch(batch: Film[]): Promise<(TmdbMovie | null)[]> {
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

/** Resolves films against /api/enrich in batches, reporting progress after each batch. */
export async function enrichFilms(
	films: Film[],
	onProgress: (done: number, total: number) => void
): Promise<EnrichedFilm[]> {
	const batches: Film[][] = [];
	for (let start = 0; start < films.length; start += BATCH_SIZE) {
		batches.push(films.slice(start, start + BATCH_SIZE));
	}

	const results: (TmdbMovie | null)[][] = new Array(batches.length);
	let done = 0;
	let next = 0;
	async function worker() {
		while (next < batches.length) {
			const index = next++;
			results[index] = await enrichBatch(batches[index]);
			done += batches[index].length;
			onProgress(done, films.length);
		}
	}
	await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, batches.length) }, worker));

	return films.map((film, i) => ({
		...film,
		tmdb: results[Math.floor(i / BATCH_SIZE)][i % BATCH_SIZE]
	}));
}
