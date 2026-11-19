import type { EnrichedFilm } from '$lib/types';

/** A rating of a film on one 0-100 scale, so any two sources compare directly. */
export interface RatingSource {
	key: 'yours' | 'tmdb' | 'imdb' | 'rt' | 'metacritic';
	label: string;
	/** The film's rating on a 0-100 scale; null where the source has none. */
	of: (film: EnrichedFilm) => number | null;
}

export const YOURS: RatingSource = {
	key: 'yours',
	label: 'You',
	of: (film) => (film.rating === null ? null : film.rating * 20)
};

/** TMDB answers 0 for a film nobody has rated yet, so 0 counts as no score. */
export const TMDB: RatingSource = {
	key: 'tmdb',
	label: 'TMDB',
	of: (film) => (film.tmdb?.voteAverage ? film.tmdb.voteAverage * 10 : null)
};

export const IMDB: RatingSource = {
	key: 'imdb',
	label: 'IMDb',
	of: (film) => (film.omdb?.imdbRating != null ? film.omdb.imdbRating * 10 : null)
};

export const ROTTEN_TOMATOES: RatingSource = {
	key: 'rt',
	label: 'Rotten Tomatoes',
	of: (film) => film.omdb?.rottenTomatoes ?? null
};

export const METACRITIC: RatingSource = {
	key: 'metacritic',
	label: 'Metacritic',
	of: (film) => film.omdb?.metascore ?? null
};

/** Your rating first, then the external sources: the axis order of every rating comparison. */
export const SOURCES: RatingSource[] = [YOURS, TMDB, IMDB, ROTTEN_TOMATOES, METACRITIC];

/** How far your rating sits from a source's, both 0-100; positive when you rate higher. */
export interface RatingGap {
	film: EnrichedFilm;
	yours: number;
	source: number;
	gap: number;
}

/** Your gap to `source` on every film both of you rated. */
export function gapsTo(films: EnrichedFilm[], source: RatingSource): RatingGap[] {
	return films.flatMap((film) => {
		const yours = YOURS.of(film);
		const theirs = source.of(film);
		return yours === null || theirs === null
			? []
			: [{ film, yours, source: theirs, gap: yours - theirs }];
	});
}

/** A 0-100 score on the five-star scale. */
export const toStars = (score: number): number => score / 20;

/** A RatingGap read in stars: `yours`, `source` and `gap` all on the five-star scale. */
export type StarGap = RatingGap;

/** Your gap to `source` on every film both of you rated, in stars. */
export function starGapsTo(films: EnrichedFilm[], source: RatingSource): StarGap[] {
	return gapsTo(films, source).map(({ film, yours, source: theirs, gap }) => ({
		film,
		yours: toStars(yours),
		source: toStars(theirs),
		gap: toStars(gap)
	}));
}

/** The `n` widest gaps each way: films you rate above the source, then films it rates above you. */
export function extremes<T extends { gap: number }>(
	gaps: T[],
	n: number
): { over: T[]; under: T[] } {
	const sorted = [...gaps].sort((a, b) => b.gap - a.gap);
	return {
		over: sorted.slice(0, n).filter((g) => g.gap > 0),
		under: sorted
			.slice(-n)
			.filter((g) => g.gap < 0)
			.reverse()
	};
}
