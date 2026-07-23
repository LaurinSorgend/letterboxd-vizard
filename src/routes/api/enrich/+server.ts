import { json, error } from '@sveltejs/kit';
import pLimit from 'p-limit';
import { BudgetExhausted, FetchBudget, FETCHES_PER_REQUEST } from '$lib/server/budget';
import { cacheKey, getCachedMany, putCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import { lookupMovie } from '$lib/server/tmdb';
import type { EnrichRequestItem, TmdbMovie } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_BATCH = 100;
const CONCURRENCY = 5;

export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.ENRICH_LIMITER, getClientAddress());

	const db = await getDb(platform);
	const body = (await request.json().catch(() => null)) as { items?: EnrichRequestItem[] } | null;
	const items = body?.items;
	if (!Array.isArray(items) || items.some((i) => typeof i?.name !== 'string')) {
		error(400, 'Expected body: { items: { name: string, year: number | null }[] }');
	}
	if (items.length > MAX_BATCH) {
		error(400, `Batch too large, send at most ${MAX_BATCH} items`);
	}

	const keys = items.map((item) => cacheKey(item.name, item.year));
	const known = await getCachedMany(db, [...new Set(keys)]);

	// Budget and limiter are per-request: Workers cap subrequests per invocation
	// (50 on the free plan) and forbid I/O queued from another request's context.
	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const limit = pLimit(CONCURRENCY);
	const resolved = new Map<string, TmdbMovie | null>();
	const deferred = new Set<string>();
	const lookups = new Map<string, Promise<void>>();
	for (const [index, item] of items.entries()) {
		const key = keys[index];
		if (known.has(key) || lookups.has(key)) continue;
		lookups.set(
			key,
			(async () => {
				try {
					const movie = await limit(() => lookupMovie(budget, item.name, item.year));
					resolved.set(key, movie);
					console.log(`tmdb lookup: ${key} -> ${movie ? movie.tmdbId : 'no match'}`);
				} catch (cause) {
					// Not cached: the client retries deferred and failed lookups.
					deferred.add(key);
					if (!(cause instanceof BudgetExhausted)) {
						console.error(`tmdb lookup failed: ${key}`, cause);
					}
				}
			})()
		);
	}
	await Promise.all(lookups.values());
	await putCachedMany(db, [...resolved]);

	const results = keys.map((key) => known.get(key) ?? resolved.get(key) ?? null);
	const pending = [...keys.entries()].filter(([, key]) => deferred.has(key)).map(([i]) => i);
	return json({ results, pending });
};
