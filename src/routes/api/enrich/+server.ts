import { json } from '@sveltejs/kit';
import { readBatch, requestContext } from '$lib/server/batch';
import { resolveEnrich } from '$lib/server/enrich';
import type { EnrichRequestItem } from '$lib/types';
import type { RequestHandler } from './$types';

const isItem = (item: unknown): item is EnrichRequestItem =>
	typeof (item as EnrichRequestItem | null)?.name === 'string';

/** Body `{ items }` of Letterboxd (name, year) pairs; answers each film's TMDB record. */
export const POST: RequestHandler = async ({ request, platform }) => {
	const expected = '{ items: { name: string, year: number | null }[] }';
	const { items } = await readBatch(request, 'items', isItem, expected);
	return json(await resolveEnrich(items, await requestContext(platform)));
};
