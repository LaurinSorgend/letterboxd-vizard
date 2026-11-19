import { aggregateCountries, type CountryStat } from '$lib/film/tally';
import { avgRating, byLanguage, totalRuntimeMinutes, type BarDatum } from '$lib/film/tally';
import { entriesIn, type Library } from '../library';
import type { EnrichedFilm } from '$lib/types';

/** Series count at their whole-run length, the way the library totals them. */
export function hours(library: Library): number {
	return Math.round(totalRuntimeMinutes(library.slice) / 60);
}

export function averageRating(library: Library): number | null {
	return avgRating(library.slice);
}

/** Diary entries flagged as rewatches: counted per viewing, not per film. */
export function rewatches(library: Library): number {
	return library.slice.reduce(
		(sum, film) => sum + entriesIn(film, library.year).filter((entry) => entry.rewatch).length,
		0
	);
}

/** Countries of production, most-watched first, ties by name. */
export function countries(library: Library): CountryStat[] {
	return [...aggregateCountries(library.slice).values()].sort(
		(a, b) => b.count - a.count || a.name.localeCompare(b.name)
	);
}

/** Original languages by display name, so codes that name one language count once. */
export function languages(library: Library): BarDatum[] {
	return byLanguage(library.slice);
}

/** Best first: the higher rating, then the hearted film, then the name. Unrated films sort last. */
export function byRating(a: EnrichedFilm, b: EnrichedFilm): number {
	return (
		(b.rating ?? 0) - (a.rating ?? 0) ||
		Number(b.liked) - Number(a.liked) ||
		a.name.localeCompare(b.name)
	);
}

/** Every rated film of the year, best first. */
export function topRated(library: Library): EnrichedFilm[] {
	return library.slice.filter((film) => film.rating !== null).sort(byRating);
}
