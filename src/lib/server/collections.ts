import { DAY_MS } from '$lib/math';
import type { CollectionParts } from '$lib/types';
import type { BatchLookup } from './batch';
import type { FetchBudget } from './budget';
import { jsonCache } from './cache';
import { tmdbGet } from './tmdb';

/**
 * A franchise's full size under TMDB's own name ("Alien Collection"), or null when TMDB answers
 * without one. One subrequest, and the answer changes about once a decade.
 */
export async function fetchCollection(
	budget: FetchBudget,
	id: number
): Promise<CollectionParts | null> {
	const data = (await tmdbGet(budget, `/collection/${id}`, {})) as {
		id?: number;
		name?: string;
		parts?: unknown[];
	} | null;
	if (!data?.id || !Array.isArray(data.parts)) return null;
	return { id: data.id, name: data.name ?? '', total: data.parts.length };
}

/** Franchise sizes by collection id. A null answer is not cached; the id came from a record that names it. */
export const collections: BatchLookup<number, number, CollectionParts | null> = {
	keyOf: (id) => id,
	cache: jsonCache<number, CollectionParts | null>({
		table: 'collections',
		key: 'collection_id',
		ttlMs: 90 * DAY_MS
	}),
	fetchOne: fetchCollection,
	label: 'tmdb collection'
};
