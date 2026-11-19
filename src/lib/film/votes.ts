import type { EnrichedFilm } from '$lib/types';

/** How widely a film has been seen: TMDB and IMDb votes together, 0 when neither counted it. */
export const votes = (film: EnrichedFilm): number =>
	(film.tmdb?.voteCount ?? 0) + (film.omdb?.imdbVotes ?? 0);

/** Under this many `votes()` a film is obscure; computations and their copy both read it. */
export const OBSCURE_VOTES = 1_000;
/** Over this many `votes()` a film is widely seen. */
export const POPULAR_VOTES = 10_000;

/*
 * The same bars on TMDB's own vote count, for the measures tuned on it (the obscurity spread and
 * The Omnivore). They are separate so retuning one scale leaves the other alone.
 */
/** Under this many TMDB votes a film is obscure. */
export const TMDB_OBSCURE_VOTES = 1_000;
/** Over this many TMDB votes a film is widely seen. */
export const TMDB_POPULAR_VOTES = 10_000;
