import { json } from '@sveltejs/kit';
import { isInteger, readBatch, requestContext, resolveBatch } from '$lib/server/batch';
import { collections } from '$lib/server/collections';
import type { RequestHandler } from './$types';

/** Body `{ ids }` of TMDB collection ids; answers each franchise's name and size. */
export const POST: RequestHandler = async ({ request, platform }) => {
	const { items: ids } = await readBatch(request, 'ids', isInteger, '{ ids: number[] }');
	return json(await resolveBatch(ids, collections, await requestContext(platform)));
};
