import { json, error } from '@sveltejs/kit';
import { MAX_BATCH, resolveBatch } from '$lib/server/batch';
import { cacheKey, getCachedMany, putCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import { lookupMovie } from '$lib/server/tmdb';
import type { EnrichRequestItem } from '$lib/types';
import type { RequestHandler } from './$types';

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

	const answer = await resolveBatch(items, {
		keyOf: (item) => cacheKey(item.name, item.year),
		getCached: (keys) => getCachedMany(db, keys),
		fetchOne: async (budget, item) => {
			const movie = await lookupMovie(budget, item.name, item.year);
			console.log(`tmdb lookup: ${item.name} (${item.year}) -> ${movie?.tmdbId ?? 'no match'}`);
			return movie;
		},
		putCached: (entries) => putCachedMany(db, entries),
		label: 'tmdb lookup'
	});
	return json(answer);
};
