import type { EnrichedFilm, Film, TmdbMovie } from '$lib/types';

const BATCH_SIZE = 50;

/** Resolves films against /api/enrich in batches, reporting progress after each batch. */
export async function enrichFilms(
	films: Film[],
	onProgress: (done: number, total: number) => void
): Promise<EnrichedFilm[]> {
	const enriched: EnrichedFilm[] = [];
	for (let start = 0; start < films.length; start += BATCH_SIZE) {
		const batch = films.slice(start, start + BATCH_SIZE);
		const response = await fetch('/api/enrich', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ items: batch.map((f) => ({ name: f.name, year: f.year })) })
		});
		if (!response.ok) {
			throw new Error(`Enrichment failed (${response.status}): ${await response.text()}`);
		}
		const { results } = (await response.json()) as { results: (TmdbMovie | null)[] };
		batch.forEach((film, i) => enriched.push({ ...film, tmdb: results[i] }));
		onProgress(enriched.length, films.length);
	}
	return enriched;
}
