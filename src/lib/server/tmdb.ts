import { env } from '$env/dynamic/private';
import type { Person, TmdbMovie } from '$lib/types';
import { BudgetExhausted, type FetchBudget } from './budget';
import { lookupSeriesOnTvdb } from './tvdb';

const BASE = 'https://api.themoviedb.org/3';
const RETRY_WAIT_MS = 500;
const MAX_RETRY_WAIT_MS = 2000;

interface SearchResult {
	id: number;
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
}

function apiKey(): string {
	const key = env.TMDB_API_KEY;
	if (!key) throw new Error('TMDB_API_KEY is not set — add it to .env');
	return key;
}

/** Supports both v3 API keys (query param) and v4 read access tokens (JWT bearer). */
async function tmdbGet(
	budget: FetchBudget,
	path: string,
	params: Record<string, string>
): Promise<unknown> {
	const key = apiKey();
	const isBearer = key.startsWith('eyJ');
	const url = new URL(BASE + path);
	for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
	if (!isBearer) url.searchParams.set('api_key', key);
	const headers: Record<string, string> = isBearer ? { Authorization: `Bearer ${key}` } : {};

	for (let attempt = 0; ; attempt++) {
		budget.take();
		const response = await fetch(url, { headers });
		if (response.ok) return response.json();
		const detail = await response.text();
		const retryable = response.status === 429 || response.status >= 500;
		// A budget spent during the backoff means "deferred", not a real TMDB failure — keep it typed.
		if (budget.exhausted) throw new BudgetExhausted();
		if (!retryable || attempt > 0) {
			throw new Error(`TMDB ${path} failed: ${response.status} ${detail}`);
		}
		const after = Number(response.headers.get('Retry-After')) * 1000;
		const wait = after > 0 ? Math.min(after, MAX_RETRY_WAIT_MS) : RETRY_WAIT_MS;
		await new Promise((resolve) => setTimeout(resolve, wait));
	}
}

function releaseYear(result: SearchResult): number | null {
	const date = result.release_date ?? result.first_air_date;
	const year = Number.parseInt(date?.slice(0, 4) ?? '', 10);
	return Number.isFinite(year) ? year : null;
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
	return results[0] ?? null;
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
	if (year !== null) {
		const near = results.find((r) => {
			const ry = releaseYear(r);
			return ry !== null && Math.abs(ry - year) <= 1;
		});
		if (near) return { result: near, yearMatch: true };
	}
	return { result: results[0], yearMatch: year === null };
}

interface CreditPerson {
	id: number;
	name: string;
	job?: string;
	profile_path?: string | null;
}

interface Details {
	id: number;
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
	production_countries?: { iso_3166_1: string }[];
	origin_country?: string[];
	genres?: { name: string }[];
	runtime?: number | null;
	episode_run_time?: number[];
	number_of_episodes?: number | null;
	last_episode_to_air?: { runtime?: number | null } | null;
	original_language?: string;
	vote_average?: number;
	poster_path?: string | null;
	created_by?: CreditPerson[];
	credits?: { cast?: CreditPerson[]; crew?: CreditPerson[] };
}

function toPerson(p: CreditPerson): Person {
	return { name: p.name, tmdbId: p.id, profilePath: p.profile_path ?? null };
}

function dedupe(people: Person[]): Person[] {
	return [...new Map(people.map((p) => [p.name, p])).values()];
}

/**
 * Whole-run length of a series in minutes, or null if TMDB gives nothing to go on.
 * TMDB leaves `episode_run_time` empty or zeroed for many shows, so the last episode's
 * length stands in for a typical one — an estimate that overshoots when a finale runs long.
 */
function seriesRuntime(d: Details): number | null {
	const perEpisode = d.episode_run_time?.find((m) => m > 0) ?? d.last_episode_to_air?.runtime;
	if (!perEpisode || !d.number_of_episodes) return null;
	return perEpisode * d.number_of_episodes;
}

export async function fetchRecord(
	budget: FetchBudget,
	kind: 'movie' | 'tv',
	id: number
): Promise<TmdbMovie> {
	const d = (await tmdbGet(budget, `/${kind}/${id}`, { append_to_response: 'credits' })) as Details;
	const crewDirectors = d.credits?.crew?.filter((p) => p.job === 'Director') ?? [];
	const directors =
		kind === 'tv' && crewDirectors.length === 0 ? (d.created_by ?? []) : crewDirectors;
	return {
		tmdbId: d.id,
		mediaType: kind,
		title: d.title ?? d.name ?? '',
		year: releaseYear(d),
		countries: d.production_countries?.map((c) => c.iso_3166_1) ?? [],
		originCountries: d.origin_country ?? [],
		genres: d.genres?.map((g) => g.name) ?? [],
		runtime: kind === 'tv' ? seriesRuntime(d) : (d.runtime ?? null),
		originalLanguage: d.original_language ?? null,
		voteAverage: d.vote_average ?? null,
		posterPath: d.poster_path ?? null,
		directors: dedupe(directors.map(toPerson)),
		cast: d.credits?.cast?.slice(0, 10).map(toPerson) ?? []
	};
}

/**
 * Resolves a Letterboxd (title, year) pair to a compact metadata record, or null.
 * Year-respecting matches win before wrong-year fallbacks:
 * movie@year → tv@year → movie±1 → tv±1 → any movie → any tv → TheTVDB.
 */
export async function lookupMovie(
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

	const movieLoose = await searchLoose(budget, 'movie', name, year);
	if (movieLoose?.yearMatch) return fetchRecord(budget, 'movie', movieLoose.result.id);
	const tvLoose = await searchLoose(budget, 'tv', name, year);
	if (tvLoose?.yearMatch) return fetchRecord(budget, 'tv', tvLoose.result.id);

	if (movieLoose) return fetchRecord(budget, 'movie', movieLoose.result.id);
	if (tvLoose) return fetchRecord(budget, 'tv', tvLoose.result.id);

	return lookupSeriesOnTvdb(budget, name, year);
}
