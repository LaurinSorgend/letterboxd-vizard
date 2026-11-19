import { normalizeTitle } from '$lib/text';

/**
 * Letterboxd, TMDB and TheTVDB date a film by different releases (festival premiere, home
 * country, first wide release), so their years often differ by one.
 */
const YEAR_TOLERANCE = 1;

export function withinYear(year: number | null, target: number): boolean {
	return year !== null && Math.abs(year - target) <= YEAR_TOLERANCE;
}

/** Search APIs rank by relevance and popularity, not title equality. */
export function exactTitleMatches<T>(
	results: T[],
	name: string,
	titleOf: (result: T) => string
): T[] {
	const target = normalizeTitle(name);
	return results.filter((result) => normalizeTitle(titleOf(result)) === target);
}

/**
 * Among same-titled results (e.g. a remake sharing its original's name), the first, in the API's
 * ranking, within a year of `year`; the first result when none is, or when the year is unknown.
 */
export function firstNearYear<T>(
	results: T[],
	year: number | null,
	yearOfResult: (result: T) => number | null
): T | undefined {
	if (year === null) return results[0];
	return results.find((result) => withinYear(yearOfResult(result), year)) ?? results[0];
}
