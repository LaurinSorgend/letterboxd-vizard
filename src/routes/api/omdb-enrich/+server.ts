import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { MAX_BATCH, resolveBatch } from '$lib/server/batch';
import { getOmdbCachedMany, putOmdbCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { fetchOmdbRatings } from '$lib/server/omdb';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.OMDB_LIMITER, getClientAddress());

	const body = (await request.json().catch(() => null)) as { imdbIds?: string[] } | null;
	const imdbIds = body?.imdbIds;
	if (!Array.isArray(imdbIds) || imdbIds.some((id) => typeof id !== 'string')) {
		error(400, 'Expected body: { imdbIds: string[] }');
	}
	if (imdbIds.length > MAX_BATCH) {
		error(400, `Batch too large, send at most ${MAX_BATCH} items`);
	}
	// Answered before the database is opened: without a key there is nothing to look up or store.
	if (!env.OMDB_API_KEY) {
		return json({ results: imdbIds.map(() => null), pending: [] });
	}

	const db = await getDb(platform);
	const answer = await resolveBatch(imdbIds, {
		keyOf: (id) => id,
		getCached: (ids) => getOmdbCachedMany(db, ids),
		fetchOne: fetchOmdbRatings,
		putCached: (entries) => putOmdbCachedMany(db, entries),
		label: 'omdb lookup'
	});
	return json(answer);
};
