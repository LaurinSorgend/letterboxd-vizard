import { DAY_MS } from '$lib/math';
import { isTmdbId, type BatchAnswer, type EnrichRequestItem, type TmdbMovie } from '$lib/types';
import { resolveBatch, type BatchLookup, type RequestContext } from './batch';
import { RetryLater, type FetchBudget } from './budget';
import { hitMissCache, type Cache } from './cache';
import { exactTitleMatches, firstNearYear, withinYear } from './match';
import { fetchRecord, recordKey, records } from './records';
import { tmdbGet, tmdbYear } from './tmdb';
import { lookupSeriesOnTvdb } from './tvdb';

interface SearchResult {
	id: number;
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
}

const titleOf = (result: SearchResult): string => result.title ?? result.name ?? '';

function bestTitleMatch(
	results: SearchResult[],
	name: string,
	year: number | null
): SearchResult | undefined {
	return firstNearYear(exactTitleMatches(results, name, titleOf), year, tmdbYear);
}

async function searchWithYear(
	budget: FetchBudget,
	kind: 'movie' | 'tv',
	name: string,
	year: number
): Promise<SearchResult | null> {
	const yearParam = kind === 'movie' ? 'primary_release_year' : 'first_air_date_year';
	const { results } = (await tmdbGet(budget, `/search/${kind}`, {
		query: name,
		[yearParam]: String(year)
	})) as { results: SearchResult[] };
	return bestTitleMatch(results, name, year) ?? null;
}

async function searchLoose(
	budget: FetchBudget,
	kind: 'movie' | 'tv',
	name: string,
	year: number | null
): Promise<{ result: SearchResult; yearMatch: boolean } | null> {
	const { results } = (await tmdbGet(budget, `/search/${kind}`, { query: name })) as {
		results: SearchResult[];
	};
	if (results.length === 0) return null;
	const exact = bestTitleMatch(results, name, year);
	if (exact) {
		return { result: exact, yearMatch: year === null || withinYear(tmdbYear(exact), year) };
	}
	if (year !== null) {
		const near = results.find((r) => withinYear(tmdbYear(r), year));
		if (near) return { result: near, yearMatch: true };
	}
	return { result: results[0], yearMatch: year === null };
}

function lazy<T>(factory: () => Promise<T>): () => Promise<T> {
	let cached: Promise<T> | undefined;
	return () => (cached ??= factory());
}

/** Resolves a Letterboxd (title, year) pair to a compact metadata record, or null. */
async function lookupMovie(
	budget: FetchBudget,
	name: string,
	year: number | null
): Promise<TmdbMovie | null> {
	if (year !== null) {
		const movie = await searchWithYear(budget, 'movie', name, year);
		if (movie) return fetchRecord(budget, 'movie', movie.id);
		const tv = await searchWithYear(budget, 'tv', name, year);
		if (tv) return fetchRecord(budget, 'tv', tv.id);
	}

	const tvdb = await lookupSeriesOnTvdb(budget, name, year);
	if (tvdb) return tvdb;

	const movieLoose = lazy(() => searchLoose(budget, 'movie', name, year));
	const tvLoose = lazy(() => searchLoose(budget, 'tv', name, year));

	const looseTiers: { kind: 'movie' | 'tv'; find: () => Promise<SearchResult | null> }[] = [
		{
			kind: 'movie',
			find: async () => {
				const loose = await movieLoose();
				return loose?.yearMatch ? loose.result : null;
			}
		},
		{
			kind: 'tv',
			find: async () => {
				const loose = await tvLoose();
				return loose?.yearMatch ? loose.result : null;
			}
		},
		{ kind: 'movie', find: async () => (await movieLoose())?.result ?? null },
		{ kind: 'tv', find: async () => (await tvLoose())?.result ?? null }
	];

	for (const tier of looseTiers) {
		const match = await tier.find();
		if (match) return fetchRecord(budget, tier.kind, match.id);
	}

	return null;
}

/** What a Letterboxd (name, year) resolved to: a TMDB record, or a negative TheTVDB id. */
type Match = Pick<TmdbMovie, 'mediaType' | 'tmdbId'>;

/**
 * Generation of the (name, year) matches, apart from the record shape (RECORD_SCHEMA): bump it
 * when the search heuristics change, so every film is matched again.
 */
const MATCH_VERSION = 'm1';

const matches = hitMissCache<string, Match>({
	table: 'matches',
	missTable: 'misses',
	key: 'cache_key',
	version: MATCH_VERSION,
	missTtlMs: 30 * DAY_MS
});

const matchKey = (item: EnrichRequestItem): string =>
	`${item.name.trim().toLowerCase()}::${item.year ?? ''}`;

/**
 * A match whose record is gone (a RECORD_SCHEMA bump) costs one fetch by id, not a search. A
 * TheTVDB match, or an id TMDB no longer answers, falls back to searching again.
 */
async function refetch(budget: FetchBudget, match: Match): Promise<TmdbMovie | null> {
	if (!isTmdbId(match.tmdbId)) return null;
	try {
		return await fetchRecord(budget, match.mediaType, match.tmdbId);
	} catch (cause) {
		if (cause instanceof RetryLater) throw cause;
		return null;
	}
}

/**
 * Letterboxd films resolved to records, given the (name, year) matches already read for them.
 * The record is read by id from the cache /api/records and /api/recommend share; a matched film
 * whose record is missing is fetched by id, any other film is searched for.
 */
function enrichLookup(
	known: Map<string, Match | null>
): BatchLookup<EnrichRequestItem, string, TmdbMovie | null> {
	const cache: Cache<string, TmdbMovie | null> = {
		async getMany(db, keys) {
			const matched = keys.flatMap((key) => known.get(key) ?? []);
			const stored = await records.getMany(db, matched.map(recordKey));
			const answers = new Map<string, TmdbMovie | null>();
			for (const key of keys) {
				const match = known.get(key);
				const record = match && stored.get(recordKey(match));
				if (match === null || record) answers.set(key, record ?? null);
			}
			return answers;
		},
		async putMany(db, entries) {
			await matches.putMany(
				db,
				entries.map(([key, record]) => [
					key,
					record && { mediaType: record.mediaType, tmdbId: record.tmdbId }
				])
			);
			await records.putMany(
				db,
				entries.flatMap(([, record]) => (record ? [[recordKey(record), record]] : []))
			);
		}
	};
	return {
		keyOf: matchKey,
		cache,
		fetchOne: async (budget, item) => {
			const match = known.get(matchKey(item));
			const movie =
				(match && (await refetch(budget, match))) ??
				(await lookupMovie(budget, item.name, item.year));
			console.log(`tmdb lookup: ${item.name} (${item.year}) -> ${movie?.tmdbId ?? 'no match'}`);
			return movie;
		},
		label: 'tmdb lookup'
	};
}

/**
 * Resolves Letterboxd (name, year) pairs to TMDB records. The matches are read first, so the
 * lookup that fetches what is missing knows which films only need their record again.
 */
export async function resolveEnrich(
	items: EnrichRequestItem[],
	ctx: RequestContext
): Promise<BatchAnswer<TmdbMovie | null>> {
	const known = await matches.getMany(ctx.db, [...new Set(items.map(matchKey))]);
	return resolveBatch(items, enrichLookup(known), ctx);
}
