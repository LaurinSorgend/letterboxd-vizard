import type { TmdbMovie } from '$lib/types';

type WithRecord = { tmdb: TmdbMovie | null };

/** A series' `runtime` is an estimate of its whole run, not the length of one sitting. */
export const isSeries = (film: WithRecord): boolean => film.tmdb?.mediaType === 'tv';

/**
 * Minutes one diary entry adds to the period it lands in. A series' runtime spans its whole run
 * rather than the day it was logged, so it contributes none.
 */
export function periodMinutes(film: WithRecord): number {
	return isSeries(film) ? 0 : (film.tmdb?.runtime ?? 0);
}

/**
 * Minutes of one sitting, for a longest film or a mean runtime: null for a series, whose runtime
 * spans its whole run, and for a film TMDB has no runtime for.
 */
export function sittingMinutes(film: WithRecord): number | null {
	return isSeries(film) ? null : film.tmdb?.runtime || null;
}

/** Minutes a title adds to a library total: a series' whole run counts once. */
export const libraryMinutes = (film: WithRecord): number => film.tmdb?.runtime ?? 0;
