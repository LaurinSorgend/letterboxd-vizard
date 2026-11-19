import { env } from '$env/dynamic/private';
import { DAY_MS } from '$lib/math';
import type { OmdbRatings } from '$lib/types';
import type { BatchLookup } from './batch';
import type { FetchBudget } from './budget';
import { hitMissCache } from './cache';
import { budgetedFetch } from './http';

const BASE = 'https://www.omdbapi.com/';

interface OmdbResponse {
	Response: 'True' | 'False';
	Error?: string;
	imdbRating?: string;
	imdbVotes?: string;
	Metascore?: string;
	Ratings?: { Source: string; Value: string }[];
}

/** 'N/A' is OMDb's own null; a bare number or the leading digits of a "94%"/"74/100" value otherwise. */
function toNumber(value: string | undefined): number | null {
	if (!value || value === 'N/A') return null;
	const n = Number.parseFloat(value.replace(/,/g, ''));
	return Number.isFinite(n) ? n : null;
}

function rottenTomatoes(ratings: OmdbResponse['Ratings']): number | null {
	const rt = ratings?.find((r) => r.Source === 'Rotten Tomatoes');
	return toNumber(rt?.Value);
}

/** OMDb is an optional extra, like TheTVDB: without a key the ratings are simply absent. */
export const omdbConfigured = (): boolean => Boolean(env.OMDB_API_KEY);

/** Ratings for one IMDb id, or null when OMDb does not know it. */
async function fetchOmdbRatings(budget: FetchBudget, imdbId: string): Promise<OmdbRatings | null> {
	const key = env.OMDB_API_KEY;
	if (!key) throw new Error('OMDB_API_KEY is not set, add it to .env');

	const url = new URL(BASE);
	url.searchParams.set('apikey', key);
	url.searchParams.set('i', imdbId);

	const response = await budgetedFetch(budget, url, {}, `OMDb ${imdbId}`);
	const body = (await response.json()) as OmdbResponse;
	if (body.Response === 'False') return null;
	return {
		imdbRating: toNumber(body.imdbRating),
		imdbVotes: toNumber(body.imdbVotes),
		rottenTomatoes: rottenTomatoes(body.Ratings),
		metascore: toNumber(body.Metascore)
	};
}

/** OMDb ratings by IMDb id, a stable key: kept for good, and a miss asked again after a month. */
export const omdbRatings: BatchLookup<string, string, OmdbRatings | null> = {
	keyOf: (id) => id,
	cache: hitMissCache<string, OmdbRatings>({
		table: 'omdb',
		missTable: 'omdb_misses',
		key: 'imdb_id',
		missTtlMs: 30 * DAY_MS
	}),
	fetchOne: fetchOmdbRatings,
	label: 'omdb lookup'
};
