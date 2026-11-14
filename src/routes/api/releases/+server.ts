import { json, error } from '@sveltejs/kit';
import pLimit from 'p-limit';
import { BudgetExhausted, FetchBudget, FETCHES_PER_REQUEST } from '$lib/server/budget';
import { getReleasesCachedMany, putReleasesCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { fetchReleases, regionReleases, type FilmReleases } from '$lib/server/releases';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

const MAX_BATCH = 100;
const CONCURRENCY = 5;

/** Looks up every id the cache lacks; ids the budget could not cover come back in `deferred`. */
async function lookUp(ids: number[]) {
	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const limit = pLimit(CONCURRENCY);
	const resolved = new Map<number, FilmReleases>();
	const deferred = new Set<number>();
	await Promise.all(
		ids.map(async (id) => {
			try {
				resolved.set(id, await limit(() => fetchReleases(budget, id)));
			} catch (cause) {
				if (cause instanceof BudgetExhausted) deferred.add(id);
				else console.error(`tmdb release dates failed: ${id}`, cause);
			}
		})
	);
	return { resolved, deferred };
}

/** Body `{ region, ids }` of TMDB movie ids; answers each id's dates in that region, US as fallback. */
export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.PROVIDERS_LIMITER, getClientAddress());

	const body = (await request.json().catch(() => null)) as {
		ids?: unknown[];
		region?: unknown;
	} | null;
	const ids = body?.ids;
	const region = body?.region;
	if (!Array.isArray(ids) || !ids.every(Number.isInteger) || typeof region !== 'string') {
		error(400, "Expected body: { region: 'GB', ids: number[] }");
	}
	if (!/^[A-Z]{2}$/.test(region)) error(400, 'Region must be an ISO 3166-1 alpha-2 code');
	if (ids.length > MAX_BATCH) error(400, `Batch too large, send at most ${MAX_BATCH} ids`);

	const movieIds = ids as number[];
	const db = await getDb(platform);
	// Negative ids are TheTVDB records, which TMDB has no release dates for.
	const valid = [...new Set(movieIds.filter((id) => id > 0))];
	const known = await getReleasesCachedMany(db, valid);
	const { resolved, deferred } = await lookUp(valid.filter((id) => !known.has(id)));
	if (resolved.size > 0) await putReleasesCachedMany(db, [...resolved]);

	const results = movieIds.map((id) => {
		const releases = known.get(id) ?? resolved.get(id);
		return releases ? regionReleases(releases, region) : null;
	});
	const pending = [...movieIds.entries()].filter(([, id]) => deferred.has(id)).map(([i]) => i);
	return json({ results, pending });
};
