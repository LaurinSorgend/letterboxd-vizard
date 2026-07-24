import { json, error } from '@sveltejs/kit';
import pLimit, { type LimitFunction } from 'p-limit';
import type { D1Database } from '@cloudflare/workers-types';
import { getOrCreate } from '$lib/collections';
import { BudgetExhausted, FetchBudget, FETCHES_PER_REQUEST } from '$lib/server/budget';
import { cacheKey, getCachedMany, putCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import { fetchRecord } from '$lib/server/tmdb';
import { relatedMovies, traktAvailable } from '$lib/server/trakt';
import { effectiveCountries } from '$lib/viz/countries';
import type { Seed, TmdbMovie } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_SEEDS = 25;
const MAX_RESULTS = 20;
const CONCURRENCY = 5;
// Subrequests held back from the seed phase so poster/country lookups aren't starved on a cold cache.
const POSTER_RESERVE = 15;

interface RankedFilm {
	tmdbId: number;
	title: string;
	year: number | null;
}

interface Result extends RankedFilm {
	posterPath: string | null;
	countries: string[];
	/** True when the budget ran out before this film's record loaded — the client re-requests it. */
	pending: boolean;
}

/**
 * Poster/country records for the ranked films. Cache reads and writes are batched (a couple of
 * subrequests for the lot, off-budget like /api/enrich) so the budget only pays for TMDB fetches;
 * films whose fetch is cut off by the budget come back `pending` for the client to ask again later.
 */
async function resolveRecords(
	db: D1Database,
	budget: FetchBudget,
	limit: LimitFunction,
	ranked: RankedFilm[]
): Promise<Result[]> {
	const cached = await getCachedMany(db, [
		...new Set(ranked.map((r) => cacheKey(r.title, r.year)))
	]);
	const records = new Map<number, TmdbMovie | null>();
	const pending = new Set<number>();
	const toWrite: [string, TmdbMovie | null][] = [];
	await Promise.all(
		ranked.map((film) =>
			limit(async () => {
				const key = cacheKey(film.title, film.year);
				const hit = cached.get(key);
				if (hit && hit.tmdbId === film.tmdbId) return void records.set(film.tmdbId, hit);
				try {
					const record = await fetchRecord(budget, 'movie', film.tmdbId);
					records.set(film.tmdbId, record);
					if (!hit) toWrite.push([key, record]); // keep a colliding title/year entry intact
				} catch (cause) {
					if (cause instanceof BudgetExhausted) return void pending.add(film.tmdbId);
					console.error(`tmdb details failed for ${film.tmdbId}`, cause);
					records.set(film.tmdbId, null);
				}
			})
		)
	);
	if (toWrite.length > 0) await putCachedMany(db, toWrite);
	return ranked.map((film) => {
		const record = records.get(film.tmdbId) ?? null;
		return {
			...film,
			posterPath: record?.posterPath ?? null,
			countries: record ? effectiveCountries(record) : [],
			pending: pending.has(film.tmdbId)
		};
	});
}

export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.RECOMMEND_LIMITER, getClientAddress());

	if (!traktAvailable()) return json({ available: false, results: [] });

	const db = await getDb(platform);
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
	// The reserve keeps a slice for phase 2 so a cold seed phase can't spend it all.
	const budget = new FetchBudget(FETCHES_PER_REQUEST, POSTER_RESERVE);
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
						const entry = getOrCreate(scores, movie.tmdbId, () => ({ ...movie, score: 0 }));
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

	// Seed lookups are done; hand the reserved subrequests to the poster/country phase below.
	budget.releaseReserve();

	const ranked = [...scores.values()]
		.sort((a, b) => b.score - a.score || (b.traktRating ?? 0) - (a.traktRating ?? 0))
		.slice(0, MAX_RESULTS);
	const results = await resolveRecords(db, budget, limit, ranked);
	return json({ available: true, results });
};
