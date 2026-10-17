import { json, error } from '@sveltejs/kit';
import pLimit from 'p-limit';
import { BudgetExhausted, FetchBudget, FETCHES_PER_REQUEST } from '$lib/server/budget';
import { getProvidersCachedMany, putProvidersCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { fetchAvailability, regionOffers, type WatchAvailability } from '$lib/server/providers';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import type { ProviderRequestItem } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_BATCH = 100;
const CONCURRENCY = 5;

const mediaKey = (item: ProviderRequestItem) => `${item.mediaType}:${item.tmdbId}`;

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
	// Negative ids are TheTVDB records, which TMDB has no availability for.
	const keys = items.map((item) => (item.tmdbId > 0 ? mediaKey(item) : null));
	const known = await getProvidersCachedMany(db, [
		...new Set(keys.filter((key): key is string => key !== null))
	]);

	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const limit = pLimit(CONCURRENCY);
	const resolved = new Map<string, WatchAvailability>();
	const deferred = new Set<string>();
	const lookups = new Map<string, Promise<void>>();
	for (const [index, item] of items.entries()) {
		const key = keys[index];
		if (!key || known.has(key) || lookups.has(key)) continue;
		lookups.set(
			key,
			(async () => {
				try {
					resolved.set(
						key,
						await limit(() => fetchAvailability(budget, item.mediaType, item.tmdbId))
					);
				} catch (cause) {
					deferred.add(key);
					if (!(cause instanceof BudgetExhausted)) {
						console.error(`tmdb providers failed: ${key}`, cause);
					}
				}
			})()
		);
	}
	await Promise.all(lookups.values());
	if (resolved.size > 0) await putProvidersCachedMany(db, [...resolved]);

	const results = keys.map((key) => {
		const availability = key ? (known.get(key) ?? resolved.get(key)) : undefined;
		return availability ? regionOffers(availability, region) : null;
	});
	const pending = [...keys.entries()]
		.filter(([, key]) => key !== null && deferred.has(key))
		.map(([i]) => i);
	return json({ results, pending });
};
