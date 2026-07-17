import { env } from '$env/dynamic/private';
import worldCountries from 'world-countries';
import type { TmdbMovie } from '$lib/types';
import type { FetchBudget } from './budget';

const BASE = 'https://api4.thetvdb.com/v4';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const alpha3to2 = new Map(worldCountries.map((c) => [c.cca3.toLowerCase(), c.cca2]));

let session: { token: string; fetchedAt: number } | null = null;

async function token(budget: FetchBudget): Promise<string> {
	if (session && Date.now() - session.fetchedAt < TOKEN_TTL_MS) return session.token;
	budget.take();
	const response = await fetch(`${BASE}/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ apikey: env.TVDB_API_KEY })
	});
	if (!response.ok) throw new Error(`TheTVDB login failed: ${response.status}`);
	const body = (await response.json()) as { data: { token: string } };
	session = { token: body.data.token, fetchedAt: Date.now() };
	return session.token;
}

async function tvdbGet(budget: FetchBudget, path: string): Promise<unknown> {
	const auth = await token(budget);
	budget.take();
	const response = await fetch(BASE + path, {
		headers: { Authorization: `Bearer ${auth}` }
	});
	if (!response.ok) throw new Error(`TheTVDB ${path} failed: ${response.status}`);
	return response.json();
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
	const match =
		year === null
			? results[0]
			: (results.find((r) => Math.abs(Number.parseInt(r.year ?? '', 10) - year) <= 1) ??
				results[0]);
	if (!match) return null;

	let details: TvdbSeries = {};
	try {
		// meta=episodes rides along on this request; the count is half of the whole-run runtime.
		details = (
			(await tvdbGet(budget, `/series/${match.tvdb_id}/extended?meta=episodes&short=true`)) as {
				data: TvdbSeries;
			}
		).data;
	} catch {
		// Search hit is enough; extended details are a bonus.
	}

	const country = match.country ? alpha3to2.get(match.country.toLowerCase()) : undefined;
	return {
		tmdbId: -Number.parseInt(match.tvdb_id, 10),
		mediaType: 'tv',
		title: match.name,
		year: Number.parseInt(match.year ?? '', 10) || null,
		countries: country ? [country] : [],
		originCountries: country ? [country] : [],
		genres: details.genres?.map((g) => g.name) ?? [],
		runtime: seriesRuntime(details),
		originalLanguage: match.primary_language ?? null,
		voteAverage: null,
		posterPath: match.thumbnail ?? null,
		directors: [],
		cast: []
	};
}
