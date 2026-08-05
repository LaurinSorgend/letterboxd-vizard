import { env } from '$env/dynamic/private';
import type { OmdbRatings } from '$lib/types';
import { BudgetExhausted, type FetchBudget } from './budget';

const BASE = 'https://www.omdbapi.com/';
const RETRY_WAIT_MS = 500;
const MAX_RETRY_WAIT_MS = 2000;

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

	for (let attempt = 0; ; attempt++) {
		budget.take();
		const response = await fetch(url);
		if (response.ok) {
			const body = (await response.json()) as OmdbResponse;
			if (body.Response === 'False') return null;
			return {
				imdbRating: toNumber(body.imdbRating),
				imdbVotes: toNumber(body.imdbVotes),
				rottenTomatoes: rottenTomatoes(body.Ratings),
				metascore: toNumber(body.Metascore)
			};
		}
		const detail = await response.text();
		const canRetry = (response.status === 429 || response.status >= 500) && attempt === 0;
		if (!canRetry) throw new Error(`OMDb ${imdbId} failed: ${response.status} ${detail}`);
		if (budget.exhausted) throw new BudgetExhausted();
		const after = Number(response.headers.get('Retry-After')) * 1000;
		const wait = after > 0 ? Math.min(after, MAX_RETRY_WAIT_MS) : RETRY_WAIT_MS;
		await new Promise((resolve) => setTimeout(resolve, wait));
	}
}
