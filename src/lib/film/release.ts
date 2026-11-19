import type { TmdbMovie } from '$lib/types';

/** The year a film came out: TMDB's, else the one Letterboxd gave. */
export const releaseYear = (film: { year: number | null; tmdb: TmdbMovie | null }): number | null =>
	film.tmdb?.year ?? film.year;
