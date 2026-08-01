import type { D1Database } from '@cloudflare/workers-types';
import type { FetchBudget } from './budget';
import { getRelatedCached, putRelatedCached, type RelatedMovie } from './cache';
import { tmdbGet } from './tmdb';

const PER_SEED = 15;

interface Recommended {
	id: number;
	title?: string;
	release_date?: string;
	vote_average?: number;
	poster_path?: string | null;
}

/**
 * Films TMDB users rated highly alongside this one, cached in D1 for a week.
 *
 * Uses /recommendations rather than /similar: the latter matches on keywords and genres
 * and calls tens of thousands of titles similar to any given film.
 */
export async function relatedMovies(
	db: D1Database,
	budget: FetchBudget,
	tmdbId: number
): Promise<RelatedMovie[]> {
	const cached = await getRelatedCached(db, tmdbId, budget);
	if (cached) return cached;

	const { results } = (await tmdbGet(budget, `/movie/${tmdbId}/recommendations`, {})) as {
		results: Recommended[];
	};
	const related = results.slice(0, PER_SEED).map((movie) => ({
		tmdbId: movie.id,
		title: movie.title ?? '',
		year: Number.parseInt(movie.release_date?.slice(0, 4) ?? '', 10) || null,
		rating: movie.vote_average ?? null,
		posterPath: movie.poster_path ?? null
	}));
	await putRelatedCached(db, tmdbId, related, budget);
	return related;
}
