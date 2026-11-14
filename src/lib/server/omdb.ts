import { env } from '$env/dynamic/private';
import type { OmdbRatings } from '$lib/types';
import type { FetchBudget } from './budget';
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

/** No key configured: OMDb enrichment is an optional extra, like TheTVDB. */
export async function fetchOmdbRatings(
	budget: FetchBudget,
	imdbId: string
): Promise<OmdbRatings | null> {
	const key = env.OMDB_API_KEY;
	if (!key) return null;

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
