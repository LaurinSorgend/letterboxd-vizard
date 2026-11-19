import { env } from '$env/dynamic/private';
import alpha2 from 'virtual:alpha3-countries';
import { yearOf } from '$lib/dates';
import { DAY_MS } from '$lib/math';
import type { TmdbMovie } from '$lib/types';
import { RetryLater, type FetchBudget } from './budget';
import { budgetedFetch } from './http';
import { exactTitleMatches, firstNearYear } from './match';

const BASE = 'https://api4.thetvdb.com/v4';
const TOKEN_TTL_MS = DAY_MS;

const alpha3to2 = new Map(Object.entries(alpha2));

let session: { token: string; fetchedAt: number } | null = null;

async function token(budget: FetchBudget): Promise<string> {
	if (session && Date.now() - session.fetchedAt < TOKEN_TTL_MS) return session.token;
	const response = await budgetedFetch(
		budget,
		new URL(`${BASE}/login`),
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ apikey: env.TVDB_API_KEY })
		},
		'TheTVDB login'
	);
	const body = (await response.json()) as { data: { token: string } };
	session = { token: body.data.token, fetchedAt: Date.now() };
	return session.token;
}

async function tvdbGet(budget: FetchBudget, path: string): Promise<unknown> {
	const auth = await token(budget);
	const init = { headers: { Authorization: `Bearer ${auth}` } };
	return (await budgetedFetch(budget, new URL(BASE + path), init, `TheTVDB ${path}`)).json();
}

interface TvdbSearchResult {
	tvdb_id: string;
	name: string;
	year?: string;
	country?: string;
	primary_language?: string;
	thumbnail?: string;
}

interface TvdbSeries {
	genres?: { name: string }[];
	averageRuntime?: number | null;
	episodes?: { id: number }[] | null;
}

/** Whole-run length in minutes, matching TmdbMovie.runtime; null unless both halves are known. */
function seriesRuntime(details: TvdbSeries): number | null {
	const episodes = details.episodes?.length;
	if (!details.averageRuntime || !episodes) return null;
	return details.averageRuntime * episodes;
}

const tvdbYear = (result: TvdbSearchResult): number | null => yearOf(result.year);

/**
 * Last-resort series lookup on TheTVDB; returns null when no TVDB_API_KEY is set.
 * Records get negative ids so they never collide with TMDB ids.
 */
export async function lookupSeriesOnTvdb(
	budget: FetchBudget,
	name: string,
	year: number | null
): Promise<TmdbMovie | null> {
	if (!env.TVDB_API_KEY) return null;

	const query = encodeURIComponent(name);
	const { data: results } = (await tvdbGet(budget, `/search?query=${query}&type=series`)) as {
		data: TvdbSearchResult[];
	};
	const match = firstNearYear(
		exactTitleMatches(results, name, (r) => r.name),
		year,
		tvdbYear
	);
	if (!match) return null;

	// A non-numeric tvdb_id would make an unusable record id (`tv:NaN`, a tmdbId that serialises as null).
	const tvdbId = Number.parseInt(match.tvdb_id, 10);
	if (!Number.isFinite(tvdbId)) return null;

	let details: TvdbSeries = {};
	try {
		// meta=episodes rides along on this request; the count is half of the whole-run runtime.
		details = (
			(await tvdbGet(budget, `/series/${match.tvdb_id}/extended?meta=episodes&short=true`)) as {
				data: TvdbSeries;
			}
		).data;
	} catch (cause) {
		// The search hit is enough on its own, but a record cut short by the budget or an outage
		// would be cached as final, so those are asked again instead.
		if (cause instanceof RetryLater) throw cause;
	}

	const country = match.country ? alpha3to2.get(match.country.toLowerCase()) : undefined;
	return {
		tmdbId: -tvdbId,
		mediaType: 'tv',
		title: match.name,
		year: tvdbYear(match),
		countries: country ? [country] : [],
		originCountries: country ? [country] : [],
		genres: details.genres?.map((g) => g.name) ?? [],
		runtime: seriesRuntime(details),
		// TheTVDB search gives a year but no full date, and no vote counts at all.
		releaseDate: null,
		originalLanguage: match.primary_language ?? null,
		voteAverage: null,
		voteCount: null,
		posterPath: match.thumbnail ?? null,
		directors: [],
		cast: [],
		collection: null,
		keywords: [],
		// TheTVDB carries no IMDb cross-reference in this lookup, so OMDb enrichment skips these.
		imdbId: null
	};
}
