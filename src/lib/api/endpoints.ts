import {
	offersKey,
	type BatchAnswer,
	type CollectionParts,
	type EnrichRequestItem,
	type FeedEntry,
	type FilmReleases,
	type OmdbRatings,
	type ProviderRequestItem,
	type Recommendation,
	type RegionOffers,
	type ReleaseKind,
	type Seed,
	type TmdbMovie,
	type UpcomingCandidate
} from '$lib/types';
import { batchFetcher, runRounds } from './batch';
import { getJson, postJson } from './http';

/** Resolves name+year items against /api/enrich in batches, reporting progress after each batch. */
export async function enrichFilms<T extends EnrichRequestItem>(
	items: T[],
	onProgress: (done: number, total: number) => void,
	signal?: AbortSignal
): Promise<(T & { tmdb: TmdbMovie | null })[]> {
	const tmdb: (TmdbMovie | null)[] = new Array(items.length).fill(null);

	await runRounds<T, TmdbMovie>({
		items,
		send: (batch) =>
			postJson<BatchAnswer<TmdbMovie>>(
				'/api/enrich',
				{ items: batch.map((f) => ({ name: f.name, year: f.year })) },
				'Enrichment',
				signal
			),
		keep: (index, movie) => {
			tmdb[index] = movie;
		},
		onProgress,
		signal
	});

	return items.map((item, i) => ({ ...item, tmdb: tmdb[i] }));
}

/**
 * OMDb ratings of distinct IMDb ids. Without an OMDb key the server resolves every id to null; ids
 * whose batches keep failing are left out.
 */
export const enrichOmdb = batchFetcher<string, string, OmdbRatings>({
	url: '/api/omdb-enrich',
	label: 'OMDb enrichment',
	body: (imdbIds) => ({ imdbIds }),
	keyOf: (id) => id
});

/** Where each title can be watched in `region`, keyed by `offersKey`; null means offered nowhere. */
export const providersFetcher = (region: string) =>
	batchFetcher<ProviderRequestItem, string, RegionOffers>({
		url: '/api/providers',
		label: 'Provider lookup',
		body: (items) => ({ region, items }),
		keyOf: offersKey
	});

/** Release dates of each movie in every country, keyed by TMDB id; null means TMDB has none. */
export const fetchReleaseDates = batchFetcher<number, number, FilmReleases>({
	url: '/api/releases',
	label: 'Release date lookup',
	body: (ids) => ({ ids }),
	keyOf: (id) => id
});

/** Full TMDB records, keyed by TMDB id; null where TMDB has none. */
export const fetchRecords = batchFetcher<number, number, TmdbMovie>({
	url: '/api/records',
	label: 'Record lookup',
	body: (ids) => ({ ids }),
	keyOf: (id) => id
});

const collectionsFetcher = batchFetcher<number, number, CollectionParts>({
	url: '/api/collections',
	label: 'Collection lookup',
	body: (ids) => ({ ids }),
	keyOf: (id) => id
});

/**
 * Collection sizes for the franchises in a library, keeping only ids TMDB knows a collection for.
 * The name is kept raw; `collectionName` strips TMDB's suffix where it is shown.
 */
export async function fetchCollections(ids: number[]): Promise<CollectionParts[]> {
	const found = await collectionsFetcher([...new Set(ids)]);
	return [...found.values()].filter((parts) => parts !== null);
}

/** Films releasing soon in a region, including new work by the given people. */
export async function fetchUpcoming(
	region: string,
	kinds: ReleaseKind[],
	people: number[],
	signal?: AbortSignal
): Promise<UpcomingCandidate[]> {
	const { candidates } = await postJson<{ candidates: UpcomingCandidate[] }>(
		'/api/upcoming',
		{ region, kinds, people },
		'Upcoming lookup',
		signal
	);
	return candidates;
}

/** A member's public feed; throws with the server's message on failure. */
export async function fetchFeed(username: string): Promise<FeedEntry[]> {
	const { entries } = await getJson<{ entries: FeedEntry[] }>(
		`/api/feed/${encodeURIComponent(username)}`,
		'Feed request'
	);
	return entries;
}

/** Films related to the seeds; empty when TMDB can't be reached. */
export async function fetchRecommendations(
	seeds: Seed[],
	exclude: number[]
): Promise<Recommendation[]> {
	if (seeds.length === 0) return [];
	const { results } = await postJson<{ results: Recommendation[] }>(
		'/api/recommend',
		{ seeds, exclude },
		'Recommendations'
	);
	return results;
}
