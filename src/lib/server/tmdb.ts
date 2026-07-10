import { env } from '$env/dynamic/private';
import type { Person, TmdbMovie } from '$lib/types';
import { lookupSeriesOnTvdb } from './tvdb';

const BASE = 'https://api.themoviedb.org/3';

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
async function tmdbGet(path: string, params: Record<string, string>): Promise<unknown> {
	const key = apiKey();
	const isBearer = key.startsWith('eyJ');
	const url = new URL(BASE + path);
	for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
	if (!isBearer) url.searchParams.set('api_key', key);

	const response = await fetch(url, {
		headers: isBearer ? { Authorization: `Bearer ${key}` } : {}
	});
	if (!response.ok) {
		throw new Error(`TMDB ${path} failed: ${response.status} ${await response.text()}`);
	}
	return response.json();
}

function releaseYear(result: SearchResult): number | null {
	const date = result.release_date ?? result.first_air_date;
	const year = Number.parseInt(date?.slice(0, 4) ?? '', 10);
	return Number.isFinite(year) ? year : null;
}

async function searchWithYear(
	kind: 'movie' | 'tv',
	name: string,
	year: number
): Promise<SearchResult | null> {
	const yearParam = kind === 'movie' ? 'primary_release_year' : 'first_air_date_year';
	const { results } = (await tmdbGet(`/search/${kind}`, {
		query: name,
		[yearParam]: String(year)
	})) as { results: SearchResult[] };
	return results[0] ?? null;
}

async function searchLoose(
	kind: 'movie' | 'tv',
	name: string,
	year: number | null
): Promise<{ result: SearchResult; yearMatch: boolean } | null> {
	const { results } = (await tmdbGet(`/search/${kind}`, { query: name })) as {
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

export async function fetchRecord(kind: 'movie' | 'tv', id: number): Promise<TmdbMovie> {
	const d = (await tmdbGet(`/${kind}/${id}`, { append_to_response: 'credits' })) as Details;
	const crewDirectors = d.credits?.crew?.filter((p) => p.job === 'Director') ?? [];
	const directors = kind === 'tv' && crewDirectors.length === 0 ? (d.created_by ?? []) : crewDirectors;
	return {
		tmdbId: d.id,
		mediaType: kind,
		title: d.title ?? d.name ?? '',
		year: releaseYear(d),
		countries: d.production_countries?.map((c) => c.iso_3166_1) ?? [],
		originCountries: d.origin_country ?? [],
		genres: d.genres?.map((g) => g.name) ?? [],
		runtime: d.runtime ?? d.episode_run_time?.[0] ?? null,
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
export async function lookupMovie(name: string, year: number | null): Promise<TmdbMovie | null> {
	if (year !== null) {
		const movie = await searchWithYear('movie', name, year);
		if (movie) return fetchRecord('movie', movie.id);
		const tv = await searchWithYear('tv', name, year);
		if (tv) return fetchRecord('tv', tv.id);
	}

	const movieLoose = await searchLoose('movie', name, year);
	if (movieLoose?.yearMatch) return fetchRecord('movie', movieLoose.result.id);
	const tvLoose = await searchLoose('tv', name, year);
	if (tvLoose?.yearMatch) return fetchRecord('tv', tvLoose.result.id);

	if (movieLoose) return fetchRecord('movie', movieLoose.result.id);
	if (tvLoose) return fetchRecord('tv', tvLoose.result.id);

	return lookupSeriesOnTvdb(name, year);
}
