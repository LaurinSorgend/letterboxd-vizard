import { DAY_MS } from '$lib/math';
import type { BatchLookup } from './batch';
import type { FetchBudget } from './budget';
import { jsonCache } from './cache';
import { yearOf } from '$lib/dates';
import { tmdbGet } from './tmdb';

const PER_SEED = 15;

export interface RelatedMovie {
	tmdbId: number;
	title: string;
	year: number | null;
	rating: number | null;
	posterPath: string | null;
}

interface Recommended {
	id: number;
	title?: string;
	release_date?: string;
	vote_average?: number;
	poster_path?: string | null;
}

/**
 * Films TMDB users rated highly alongside this one.
 *
 * Uses /recommendations rather than /similar: the latter matches on keywords and genres
 * and calls tens of thousands of titles similar to any given film.
 */
async function fetchRelated(budget: FetchBudget, tmdbId: number): Promise<RelatedMovie[]> {
	const { results } = (await tmdbGet(budget, `/movie/${tmdbId}/recommendations`, {})) as {
		results: Recommended[];
	};
	return results.slice(0, PER_SEED).map((movie) => ({
		tmdbId: movie.id,
		title: movie.title ?? '',
		year: yearOf(movie.release_date),
		rating: movie.vote_average ?? null,
		posterPath: movie.poster_path ?? null
	}));
}

/** Related films per seed movie id. TMDB's recommendations shift slowly, so they keep for months. */
export const related: BatchLookup<number, number, RelatedMovie[]> = {
	keyOf: (id) => id,
	cache: jsonCache<number, RelatedMovie[]>({
		table: 'related',
		key: 'tmdb_id',
		ttlMs: 90 * DAY_MS
	}),
	fetchOne: fetchRelated,
	label: 'tmdb recommendations'
};
