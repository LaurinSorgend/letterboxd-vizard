import { json } from '@sveltejs/kit';
import { isInteger, readBatch, requestContext, resolveBatch } from '$lib/server/batch';
import { freshMovieRecords } from '$lib/server/records';
import type { RequestHandler } from './$types';

/** Body `{ ids }` of TMDB movie ids; answers each film's full record. */
export const POST: RequestHandler = async ({ request, platform }) => {
	const { items: ids } = await readBatch(request, 'ids', isInteger, '{ ids: number[] }');
	return json(await resolveBatch(ids, freshMovieRecords, await requestContext(platform)));
};
