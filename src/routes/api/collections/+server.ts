import { json, error } from '@sveltejs/kit';
import pLimit from 'p-limit';
import { FetchBudget, FETCHES_PER_REQUEST } from '$lib/server/budget';
import { getCollectionsCachedMany, putCollectionsCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import { fetchCollection } from '$lib/server/tmdb';
import type { CollectionParts } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_BATCH = 100;
const CONCURRENCY = 5;

export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.ENRICH_LIMITER, getClientAddress());

	const db = await getDb(platform);
	const body = (await request.json().catch(() => null)) as { ids?: number[] } | null;
	const ids = body?.ids;
	if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id))) {
		error(400, 'Expected body: { ids: number[] }');
	}
	if (ids.length > MAX_BATCH) error(400, `Batch too large, send at most ${MAX_BATCH} ids`);

	const unique = [...new Set(ids)];
	const known = await getCollectionsCachedMany(db, unique);

	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const limit = pLimit(CONCURRENCY);
	const resolved = new Map<number, CollectionParts | null>();
	const deferred = new Set<number>();
	// fetchCollection only ever throws BudgetExhausted; every other TMDB failure is
	// caught and logged there, resolving to null instead of reaching this catch.
	await Promise.all(
		unique
			.filter((id) => !known.has(id))
			.map(async (id) => {
				try {
					resolved.set(id, await limit(() => fetchCollection(budget, id)));
				} catch {
					deferred.add(id);
				}
			})
	);
	await putCollectionsCachedMany(db, [...resolved]);

	const results = ids.map((id) => known.get(id) ?? resolved.get(id) ?? null);
	const pending = [...ids.entries()].filter(([, id]) => deferred.has(id)).map(([i]) => i);
	return json({ results, pending });
};
