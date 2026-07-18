import { env } from '$env/dynamic/private';
import type { D1Database } from '@cloudflare/workers-types';
import type { FetchBudget } from './budget';
import { getRelatedCached, putRelatedCached, type RelatedMovie } from './cache';

const BASE = 'https://api.trakt.tv';

export function traktAvailable(): boolean {
	return Boolean(env.TRAKT_CLIENT_ID);
}

async function traktGet(budget: FetchBudget, path: string): Promise<unknown> {
	budget.take();
	const response = await fetch(BASE + path, {
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'letterboxd-vizard (+https://codeberg.org/LaurinS/letterboxd-vizard)',
			'trakt-api-version': '2',
			'trakt-api-key': env.TRAKT_CLIENT_ID ?? ''
		}
	});
	if (!response.ok) throw new Error(`Trakt ${path} failed: ${response.status}`);
	return response.json();
}

interface TraktMovie {
	title: string;
	year: number | null;
	rating?: number;
	ids: { slug: string; tmdb: number | null };
}

/** Related movies for a TMDB id, cached in D1 for a week. */
export async function relatedMovies(
	db: D1Database,
	budget: FetchBudget,
	tmdbId: number
): Promise<RelatedMovie[]> {
	const cached = await getRelatedCached(db, tmdbId, budget);
	if (cached) return cached;

	const found = (await traktGet(budget, `/search/tmdb/${tmdbId}?type=movie`)) as {
		movie: TraktMovie;
	}[];
	const slug = found[0]?.movie.ids.slug;
	let related: RelatedMovie[] = [];
	if (slug) {
		const movies = (await traktGet(
			budget,
			`/movies/${slug}/related?limit=15&extended=full`
		)) as TraktMovie[];
		related = movies
			.filter((m) => m.ids.tmdb !== null)
			.map((m) => ({
				tmdbId: m.ids.tmdb as number,
				title: m.title,
				year: m.year,
				traktRating: m.rating ?? null
			}));
	}
	await putRelatedCached(db, tmdbId, related, budget);
	return related;
}
