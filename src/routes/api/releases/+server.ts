import { json, error } from '@sveltejs/kit';
import { isTmdbId, resolveBatch } from '$lib/server/batch';
import { getReleasesCachedMany, putReleasesCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { fetchReleases } from '$lib/server/releases';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import type { FilmReleases } from '$lib/releases/dates';
import type { RequestHandler } from './$types';

const MAX_BATCH = 100;

/**
 * Body `{ ids }` of TMDB movie ids; answers each film's dates in every country, so the client can
 * switch country without asking again. A failed lookup comes back pending for the client to retry.
 */
export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.PROVIDERS_LIMITER, getClientAddress());

	const body = (await request.json().catch(() => null)) as { ids?: unknown[] } | null;
	const ids = body?.ids;
	if (!Array.isArray(ids) || !ids.every(Number.isInteger)) {
		error(400, 'Expected body: { ids: number[] }');
	}
	if (ids.length > MAX_BATCH) error(400, `Batch too large, send at most ${MAX_BATCH} ids`);

	const db = await getDb(platform);
	const answer = await resolveBatch<number, FilmReleases>(
		(ids as number[]).map((id) => (isTmdbId(id) ? id : null)),
		{
			getCached: (keys) => getReleasesCachedMany(db, keys),
			fetchOne: fetchReleases,
			putCached: (entries) => putReleasesCachedMany(db, entries),
			retryFailures: true,
			label: 'tmdb release dates'
		}
	);
	return json(answer);
};
