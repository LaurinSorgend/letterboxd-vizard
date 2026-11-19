import { env } from '$env/dynamic/private';
import type { FetchBudget } from './budget';
import { budgetedFetch } from './http';
import { yearOf } from '$lib/dates';

const BASE = 'https://api.themoviedb.org/3';

function apiKey(): string {
	const key = env.TMDB_API_KEY;
	if (!key) throw new Error('TMDB_API_KEY is not set, add it to .env');
	return key;
}

/** Supports both v3 API keys (query param) and v4 read access tokens (JWT bearer). */
export async function tmdbGet(
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
	return (await budgetedFetch(budget, url, { headers }, `TMDB ${path}`)).json();
}

/** TMDB leaves the date an empty string when it has none, so fall through on falsy, not nullish. */
export function tmdbDate(result: {
	release_date?: string;
	first_air_date?: string;
}): string | null {
	return result.release_date || result.first_air_date || null;
}

export const tmdbYear = (result: {
	release_date?: string;
	first_air_date?: string;
}): number | null => yearOf(tmdbDate(result));
