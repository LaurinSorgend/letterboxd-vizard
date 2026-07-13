import { json, error } from '@sveltejs/kit';
import pLimit, { type LimitFunction } from 'p-limit';
import type { D1Database } from '@cloudflare/workers-types';
import { BudgetExhausted, FetchBudget } from '$lib/server/budget';
import { cacheKey, getCached, putCached } from '$lib/server/cache';
import { fetchRecord } from '$lib/server/tmdb';
import { relatedMovies, traktAvailable } from '$lib/server/trakt';
import { effectiveCountries } from '$lib/viz/countries';
import type { Seed, TmdbMovie } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_SEEDS = 25;
const MAX_RESULTS = 20;
const FETCHES_PER_REQUEST = 40;
const CONCURRENCY = 5;

/** TMDB record for a known id, reusing the title/year cache when it holds the same film. */
async function movieRecord(
	db: D1Database,
	budget: FetchBudget,
	limit: LimitFunction,
	tmdbId: number,
	title: string,
	year: number | null
): Promise<TmdbMovie | null> {
	const key = cacheKey(title, year);
	const cached = await getCached(db, key);
	if (cached && cached.tmdbId === tmdbId) return cached;
	try {
		const record = await limit(() => fetchRecord(budget, 'movie', tmdbId));
		if (!cached) await putCached(db, key, record);
		return record;
	} catch (cause) {
		if (!(cause instanceof BudgetExhausted)) {
			console.error(`tmdb details failed for ${tmdbId}`, cause);
		}
		return null;
	}
}

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!traktAvailable()) return json({ available: false, results: [] });

	const db = platform!.env.DB;
	const body = (await request.json().catch(() => null)) as {
		seeds?: Seed[];
		exclude?: number[];
	} | null;
	const seeds = body?.seeds;
	if (!Array.isArray(seeds) || seeds.some((s) => typeof s?.tmdbId !== 'number')) {
		error(400, 'Expected body: { seeds: { tmdbId, rating }[], exclude: number[] }');
	}
	const excluded = new Set((body?.exclude ?? []).filter((id) => typeof id === 'number'));

	// Budget and limiter are per-request: Workers cap subrequests per invocation
	// (50 on the free plan) and forbid I/O queued from another request's context.
	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const limit = pLimit(CONCURRENCY);

	const scores = new Map<
		number,
		{
			tmdbId: number;
			title: string;
			year: number | null;
			score: number;
			traktRating: number | null;
		}
	>();
	await Promise.all(
		seeds.slice(0, MAX_SEEDS).map((seed) =>
			limit(async () => {
				try {
					for (const movie of await relatedMovies(db, budget, seed.tmdbId)) {
						if (excluded.has(movie.tmdbId)) continue;
						let entry = scores.get(movie.tmdbId);
						if (!entry) {
							entry = { ...movie, score: 0 };
							scores.set(movie.tmdbId, entry);
						}
						entry.score += Math.max(0.5, seed.rating - 2.5);
					}
				} catch (cause) {
					if (!(cause instanceof BudgetExhausted)) {
						console.error(`trakt related failed for tmdb ${seed.tmdbId}`, cause);
					}
				}
			})
		)
	);

	const ranked = [...scores.values()]
		.sort((a, b) => b.score - a.score || (b.traktRating ?? 0) - (a.traktRating ?? 0))
		.slice(0, MAX_RESULTS);
	const results = await Promise.all(
		ranked.map(async ({ tmdbId, title, year }) => {
			const record = await movieRecord(db, budget, limit, tmdbId, title, year);
			return {
				tmdbId,
				title,
				year,
				posterPath: record?.posterPath ?? null,
				countries: record ? effectiveCountries(record) : []
			};
		})
	);
	return json({ available: true, results });
};
