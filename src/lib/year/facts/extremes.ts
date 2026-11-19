import { median } from '$lib/math';
import { type Library } from '../library';
import { releaseYear } from '$lib/film/release';
import { sittingMinutes } from '$lib/film/runtime';
import { votes } from '$lib/film/votes';
import type { EnrichedFilm } from '$lib/types';

/** The film with the lowest or highest value, the earlier one on a tie; null values sit out. */
function extremeBy(
	films: EnrichedFilm[],
	value: (film: EnrichedFilm) => number | null,
	want: 'min' | 'max'
): EnrichedFilm | null {
	let best: EnrichedFilm | null = null;
	let bestValue = want === 'min' ? Infinity : -Infinity;
	for (const film of films) {
		const candidate = value(film);
		if (candidate === null) continue;
		if (want === 'min' ? candidate < bestValue : candidate > bestValue) {
			bestValue = candidate;
			best = film;
		}
	}
	return best;
}

const counted = (film: EnrichedFilm): number | null => votes(film) || null;

/** The longest single sitting; a series' whole run is not one. */
export const longest = (library: Library): EnrichedFilm | null =>
	extremeBy(library.slice, sittingMinutes, 'max');

export const oldest = (library: Library): EnrichedFilm | null =>
	extremeBy(library.slice, releaseYear, 'min');

/** The least-voted film among those anyone has voted on. */
export const mostObscure = (library: Library): EnrichedFilm | null =>
	extremeBy(library.slice, counted, 'min');

export const mostPopular = (library: Library): EnrichedFilm | null =>
	extremeBy(library.slice, counted, 'max');

export function medianReleaseYear(library: Library): number | null {
	return median(library.slice.map(releaseYear).filter((year): year is number => year !== null));
}
