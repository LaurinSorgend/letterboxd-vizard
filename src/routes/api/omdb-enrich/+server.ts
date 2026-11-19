import { json } from '@sveltejs/kit';
import { readBatch, requestContext, resolveBatch } from '$lib/server/batch';
import { omdbConfigured, omdbRatings } from '$lib/server/omdb';
import type { RequestHandler } from './$types';

const isImdbId = (id: unknown): id is string => typeof id === 'string';

export const POST: RequestHandler = async ({ request, platform }) => {
	const { items: imdbIds } = await readBatch(request, 'imdbIds', isImdbId, '{ imdbIds: string[] }');
	// Answered before the database is opened: without a key there is nothing to look up or store.
	if (!omdbConfigured()) return json({ results: imdbIds.map(() => null), pending: [] });
	return json(await resolveBatch(imdbIds, omdbRatings, await requestContext(platform)));
};
