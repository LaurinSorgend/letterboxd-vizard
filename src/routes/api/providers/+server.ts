import { json, error } from '@sveltejs/kit';
import { isTmdbId, resolveBatch } from '$lib/server/batch';
import { getProvidersCachedMany, putProvidersCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { fetchAvailability, regionOffers, type WatchAvailability } from '$lib/server/providers';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import { offersKey, type ProviderRequestItem } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_BATCH = 100;

function isItem(item: unknown): item is ProviderRequestItem {
	const candidate = item as ProviderRequestItem | null;
	return (
		Number.isInteger(candidate?.tmdbId) &&
		(candidate?.mediaType === 'movie' || candidate?.mediaType === 'tv')
	);
}

export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.PROVIDERS_LIMITER, getClientAddress());

	const body = (await request.json().catch(() => null)) as {
		items?: unknown[];
		region?: unknown;
	} | null;
	const items = body?.items;
	const region = body?.region;
	if (!Array.isArray(items) || !items.every(isItem) || typeof region !== 'string') {
		error(400, "Expected body: { region: 'GB', items: { tmdbId, mediaType }[] }");
	}
	if (!/^[A-Z]{2}$/.test(region)) error(400, 'Region must be an ISO 3166-1 alpha-2 code');
	if (items.length > MAX_BATCH) error(400, `Batch too large, send at most ${MAX_BATCH} items`);

	const db = await getDb(platform);
	const kindOf = new Map(items.map((item) => [offersKey(item), item]));
	const { results, pending } = await resolveBatch<string, WatchAvailability>(
		items.map((item) => (isTmdbId(item.tmdbId) ? offersKey(item) : null)),
		{
			getCached: (keys) => getProvidersCachedMany(db, keys),
			fetchOne: (budget, key) => {
				const item = kindOf.get(key)!;
				return fetchAvailability(budget, item.mediaType, item.tmdbId);
			},
			putCached: (entries) => putProvidersCachedMany(db, entries),
			retryFailures: false,
			label: 'tmdb providers'
		}
	);
	return json({
		results: results.map((availability) =>
			availability ? regionOffers(availability, region) : null
		),
		pending
	});
};
