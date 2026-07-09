import { json, error } from '@sveltejs/kit';
import pLimit from 'p-limit';
import { cacheKey, getCached, putCached } from '$lib/server/cache';
import { lookupMovie } from '$lib/server/tmdb';
import type { EnrichRequestItem, TmdbMovie } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_BATCH = 100;
const limit = pLimit(10);

async function resolve(item: EnrichRequestItem): Promise<TmdbMovie | null> {
	const key = cacheKey(item.name, item.year);
	const cached = getCached(key);
	if (cached !== undefined) return cached;

	try {
		const movie = await limit(() => lookupMovie(item.name, item.year));
		putCached(key, movie);
		console.log(`tmdb lookup: ${key} -> ${movie ? movie.tmdbId : 'no match'}`);
		return movie;
	} catch (cause) {
		// Not cached: transient TMDB failures should be retried on the next visit.
		console.error(`tmdb lookup failed: ${key}`, cause);
		return null;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as { items?: EnrichRequestItem[] } | null;
	const items = body?.items;
	if (!Array.isArray(items) || items.some((i) => typeof i?.name !== 'string')) {
		error(400, 'Expected body: { items: { name: string, year: number | null }[] }');
	}
	if (items.length > MAX_BATCH) {
		error(400, `Batch too large — send at most ${MAX_BATCH} items`);
	}

	// Dedupe within the batch so identical films resolve once.
	const byKey = new Map<string, Promise<TmdbMovie | null>>();
	const results = await Promise.all(
		items.map((item) => {
			const key = cacheKey(item.name, item.year);
			let pending = byKey.get(key);
			if (!pending) {
				pending = resolve(item);
				byKey.set(key, pending);
			}
			return pending;
		})
	);

	return json({ results });
};
