import { env } from '$env/dynamic/private';
import type { TmdbMovie } from '$lib/types';

const BASE = 'https://api.themoviedb.org/3';

interface SearchResult {
	id: number;
	title: string;
	release_date?: string;
	popularity: number;
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
	const year = Number.parseInt(result.release_date?.slice(0, 4) ?? '', 10);
	return Number.isFinite(year) ? year : null;
}

async function search(name: string, year: number | null): Promise<SearchResult | null> {
	if (year !== null) {
		const byYear = (await tmdbGet('/search/movie', {
			query: name,
			primary_release_year: String(year)
		})) as { results: SearchResult[] };
		if (byYear.results.length > 0) return byYear.results[0];
	}
	const any = (await tmdbGet('/search/movie', { query: name })) as { results: SearchResult[] };
	if (any.results.length === 0) return null;
	if (year !== null) {
		const near = any.results.find((r) => {
			const ry = releaseYear(r);
			return ry !== null && Math.abs(ry - year) <= 1;
		});
		if (near) return near;
	}
	return any.results[0];
}

interface Details {
	id: number;
	title: string;
	release_date?: string;
	production_countries?: { iso_3166_1: string }[];
	origin_country?: string[];
	genres?: { name: string }[];
	runtime?: number | null;
	original_language?: string;
	vote_average?: number;
	poster_path?: string | null;
	credits?: {
		cast?: { name: string }[];
		crew?: { name: string; job: string }[];
	};
}

/** Resolves a Letterboxd (title, year) pair to a compact TMDB record, or null if unmatched. */
export async function lookupMovie(name: string, year: number | null): Promise<TmdbMovie | null> {
	const match = await search(name, year);
	if (!match) return null;

	const details = (await tmdbGet(`/movie/${match.id}`, {
		append_to_response: 'credits'
	})) as Details;

	return {
		tmdbId: details.id,
		title: details.title,
		year: Number.parseInt(details.release_date?.slice(0, 4) ?? '', 10) || null,
		countries: details.production_countries?.map((c) => c.iso_3166_1) ?? [],
		originCountries: details.origin_country ?? [],
		genres: details.genres?.map((g) => g.name) ?? [],
		runtime: details.runtime ?? null,
		originalLanguage: details.original_language ?? null,
		voteAverage: details.vote_average ?? null,
		posterPath: details.poster_path ?? null,
		directors: [...new Set(details.credits?.crew?.filter((p) => p.job === 'Director').map((p) => p.name) ?? [])],
		cast: details.credits?.cast?.slice(0, 10).map((p) => p.name) ?? []
	};
}
