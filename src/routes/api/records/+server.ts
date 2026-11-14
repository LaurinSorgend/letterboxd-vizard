import { json, error } from '@sveltejs/kit';
import { MAX_BATCH, resolveBatch } from '$lib/server/batch';
import { getRecordsCachedMany, putRecordsCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { fetchRecord } from '$lib/server/tmdb';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import { isTmdbId } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * Body `{ ids }` of TMDB movie ids; answers each film's full record by id, cached for a week since
 * credits of unreleased films still change.
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
	const answer = await resolveBatch(ids as number[], {
		keyOf: (id) => (isTmdbId(id) ? id : null),
		getCached: (keys) => getRecordsCachedMany(db, keys),
		fetchOne: (budget, id) => fetchRecord(budget, 'movie', id),
		putCached: (entries) => putRecordsCachedMany(db, entries),
		label: 'tmdb records'
	});
	return json(answer);
};
