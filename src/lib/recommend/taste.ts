import type { Film } from '$lib/types';

/** Star rating from which a film counts as a favourite. */
export const FAVOURITE_RATING = 4;

/**
 * A favourite for matching upcoming releases: rated FAVOURITE_RATING or more, or hearted. A
 * hearted film is evidence of taste even unrated, and upcoming matches are scarce.
 */
export const isFavourite = (film: Film): boolean => isRatedFavourite(film) || film.liked;

/**
 * A favourite for the "Because you love <genre>" rows: rated FAVOURITE_RATING or more. Hearts
 * don't count here, so a genre row is seeded only by films the member scored highly.
 */
export const isRatedFavourite = (film: Film): boolean =>
	film.rating !== null && film.rating >= FAVOURITE_RATING;
