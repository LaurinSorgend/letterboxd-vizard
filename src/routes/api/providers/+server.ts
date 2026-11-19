import { json, error } from '@sveltejs/kit';
import { readBatch, requestContext, resolveBatch } from '$lib/server/batch';
import { availability, isProviderItem, regionOffers } from '$lib/server/providers';
import { REGION_PATTERN } from '$lib/types';
import type { RequestHandler } from './$types';

/** Body `{ region, items }` of titles; answers each title's offers in `region`. */
export const POST: RequestHandler = async ({ request, platform }) => {
	const expected = "{ region: 'GB', items: { tmdbId, mediaType }[] }";
	const { items, body } = await readBatch(request, 'items', isProviderItem, expected);
	const region = body.region;
	if (typeof region !== 'string') error(400, `Expected body: ${expected}`);
	if (!REGION_PATTERN.test(region)) error(400, 'Region must be an ISO 3166-1 alpha-2 code');

	const { results, pending } = await resolveBatch(
		items,
		availability,
		await requestContext(platform)
	);
	return json({
		results: results.map((offers) => (offers ? regionOffers(offers, region) : null)),
		pending
	});
};
