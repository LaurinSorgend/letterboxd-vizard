import { buildLibrary, filmsLoggedPerYear, type Library, type LibraryInput } from './library';
import { verdictFor, type Personality } from './verdict';
import type { EnrichedFilm } from '$lib/types';

/** Letterboxd's own bar for a Year in Review. Under it the numbers describe noise, not a year. */
export const MIN_FILMS = 10;

/** The running year only earns a recap in December: a recap of a year three weeks old is a recap of nothing. */
const runningYearCounts = (now: Date): boolean => now.getMonth() === 11;

/** Years with enough films to be worth a recap, newest first. */
export function recapYears(films: EnrichedFilm[], now: Date): number[] {
	const current = now.getFullYear();
	return [...filmsLoggedPerYear(films)]
		.filter(([, logged]) => logged >= MIN_FILMS)
		.filter(([year]) => year < current || (year === current && runningYearCounts(now)))
		.map(([year]) => year)
		.sort((a, b) => b - a);
}

/**
 * The year the deck plays: the running year, in December. `demo` (a development switch) plays
 * the latest year worth a deck in any month, so the deck can be worked on all year.
 */
export function deckYear(
	films: EnrichedFilm[],
	now: Date,
	{ demo = false }: { demo?: boolean } = {}
): number | null {
	const years = recapYears(films, now);
	if (demo) return years[0] ?? null;
	return runningYearCounts(now) && years.includes(now.getFullYear()) ? now.getFullYear() : null;
}

export type YearContext = Omit<LibraryInput, 'films' | 'year'>;

/** One year of the library and its verdict: everything either year-in-review surface reads. */
export interface Year {
	library: Library;
	personality: Personality;
}

/** The year, or null when it is too thin to describe. */
export function buildYear(
	films: EnrichedFilm[],
	year: number,
	context: YearContext = {}
): Year | null {
	const library = buildLibrary({ films, year, ...context });
	if (library.slice.length < MIN_FILMS) return null;
	return { library, personality: verdictFor(library) };
}
