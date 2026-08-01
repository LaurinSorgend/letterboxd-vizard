import type { Seed } from '$lib/types';

export interface Recommendation {
	tmdbId: number;
	title: string;
	year: number | null;
	posterPath: string | null;
	countries: string[];
	/** The server ran out of subrequest budget before this film's record loaded; re-request to fill it. */
	pending: boolean;
}

/** Asks /api/recommend for films related to the seeds; empty when TMDB can't be reached. */
export async function fetchRecommendations(
	seeds: Seed[],
	exclude: number[]
): Promise<Recommendation[]> {
	if (seeds.length === 0) return [];
	const response = await fetch('/api/recommend', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ seeds, exclude })
	});
	if (!response.ok) throw new Error(String(response.status));
	const { available, results } = (await response.json()) as {
		available: boolean;
		results: Recommendation[];
	};
	return available ? results : [];
}
