import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import pLimit from 'p-limit';
import { BudgetExhausted, FetchBudget, FETCHES_PER_REQUEST } from '$lib/server/budget';
import { getOmdbCachedMany, putOmdbCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { fetchOmdbRatings } from '$lib/server/omdb';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import type { OmdbRatings } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_BATCH = 100;
const CONCURRENCY = 5;

export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.OMDB_LIMITER, getClientAddress());

	const db = await getDb(platform);
	const body = (await request.json().catch(() => null)) as { imdbIds?: string[] } | null;
	const imdbIds = body?.imdbIds;
	if (!Array.isArray(imdbIds) || imdbIds.some((id) => typeof id !== 'string')) {
		error(400, 'Expected body: { imdbIds: string[] }');
	}
	if (imdbIds.length > MAX_BATCH) {
		error(400, `Batch too large, send at most ${MAX_BATCH} items`);
	}
	if (!env.OMDB_API_KEY) {
		return json({ results: imdbIds.map(() => null), pending: [] });
	}

	const known = await getOmdbCachedMany(db, [...new Set(imdbIds)]);

	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const limit = pLimit(CONCURRENCY);
	const resolved = new Map<string, OmdbRatings | null>();
	const deferred = new Set<string>();
	const lookups = new Map<string, Promise<void>>();
	for (const id of imdbIds) {
		if (known.has(id) || lookups.has(id)) continue;
		lookups.set(
			id,
			(async () => {
				try {
					resolved.set(id, await limit(() => fetchOmdbRatings(budget, id)));
				} catch (cause) {
					deferred.add(id);
					if (!(cause instanceof BudgetExhausted)) {
						console.error(`omdb lookup failed: ${id}`, cause);
					}
				}
			})()
		);
	}
	await Promise.all(lookups.values());
	await putOmdbCachedMany(db, [...resolved]);

	const results = imdbIds.map((id) => known.get(id) ?? resolved.get(id) ?? null);
	const pending = [...imdbIds.entries()].filter(([, id]) => deferred.has(id)).map(([i]) => i);
	return json({ results, pending });
};
