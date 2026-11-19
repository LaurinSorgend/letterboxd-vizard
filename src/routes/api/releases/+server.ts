import { json } from '@sveltejs/kit';
import { isInteger, readBatch, requestContext, resolveBatch } from '$lib/server/batch';
import { releases } from '$lib/server/releases';
import type { RequestHandler } from './$types';

/**
 * Body `{ ids }` of TMDB movie ids; answers each film's dates in every country, so the client can
 * switch country without asking again.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const { items: ids } = await readBatch(request, 'ids', isInteger, '{ ids: number[] }');
	return json(await resolveBatch(ids, releases, await requestContext(platform)));
};
