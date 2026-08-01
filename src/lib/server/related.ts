import type { D1Database } from '@cloudflare/workers-types';
import type { LimitFunction } from 'p-limit';
import { BudgetExhausted, type FetchBudget } from './budget';
import { getRelatedCachedMany, putRelatedCachedMany, type RelatedMovie } from './cache';
import { tmdbGet } from './tmdb';

const PER_SEED = 15;

interface Recommended {
	id: number;
	title?: string;
	release_date?: string;
	vote_average?: number;
	poster_path?: string | null;
}

export interface SeedLookup {
	related: Map<number, RelatedMovie[]>;
	/** Seeds whose fetch errored, budget exhaustion aside; all of them means TMDB is unusable. */
	failed: number;
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
		year: Number.parseInt(movie.release_date?.slice(0, 4) ?? '', 10) || null,
		rating: movie.vote_average ?? null,
		posterPath: movie.poster_path ?? null
	}));
}

/**
 * Related films for every seed, reading the cache in one batched query and fetching only the
 * misses. Cache reads and writes are batched and off-budget, so the budget pays for TMDB rather
 * than for hits; seeds cut off by the budget are simply absent from the returned map.
 */
export async function relatedMoviesMany(
	db: D1Database,
	budget: FetchBudget,
	limit: LimitFunction,
	tmdbIds: number[]
): Promise<SeedLookup> {
	const related = await getRelatedCachedMany(db, tmdbIds);
	const fetched: [number, RelatedMovie[]][] = [];
	let failed = 0;
	await Promise.all(
		tmdbIds
			.filter((tmdbId) => !related.has(tmdbId))
			.map((tmdbId) =>
				limit(async () => {
					try {
						const movies = await fetchRelated(budget, tmdbId);
						related.set(tmdbId, movies);
						fetched.push([tmdbId, movies]);
					} catch (cause) {
						if (cause instanceof BudgetExhausted) return;
						failed++;
						console.error(`tmdb recommendations failed for ${tmdbId}`, cause);
					}
				})
			)
	);
	if (fetched.length > 0) await putRelatedCachedMany(db, fetched);
	return { related, failed };
}
