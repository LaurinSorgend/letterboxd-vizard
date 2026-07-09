import { json, error } from '@sveltejs/kit';
import pLimit from 'p-limit';
import { relatedMovies, traktAvailable } from '$lib/server/trakt';
import type { RequestHandler } from './$types';

const MAX_SEEDS = 25;
const limit = pLimit(5);

interface Seed {
	tmdbId: number;
	rating: number;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!traktAvailable()) return json({ available: false, results: [] });

	const body = (await request.json().catch(() => null)) as {
		seeds?: Seed[];
		exclude?: number[];
	} | null;
	const seeds = body?.seeds;
	if (!Array.isArray(seeds) || seeds.some((s) => typeof s?.tmdbId !== 'number')) {
		error(400, 'Expected body: { seeds: { tmdbId, rating }[], exclude: number[] }');
	}
	const excluded = new Set((body?.exclude ?? []).filter((id) => typeof id === 'number'));

	const scores = new Map<
		number,
		{ tmdbId: number; title: string; year: number | null; score: number; traktRating: number | null }
	>();
	await Promise.all(
		seeds.slice(0, MAX_SEEDS).map((seed) =>
			limit(async () => {
				try {
					for (const movie of await relatedMovies(seed.tmdbId)) {
						if (excluded.has(movie.tmdbId)) continue;
						let entry = scores.get(movie.tmdbId);
						if (!entry) {
							entry = { ...movie, score: 0 };
							scores.set(movie.tmdbId, entry);
						}
						entry.score += Math.max(0.5, seed.rating - 2.5);
					}
				} catch (cause) {
					console.error(`trakt related failed for tmdb ${seed.tmdbId}`, cause);
				}
			})
		)
	);

	const results = [...scores.values()]
		.sort((a, b) => b.score - a.score || (b.traktRating ?? 0) - (a.traktRating ?? 0))
		.slice(0, 20);
	return json({ available: true, results });
};
