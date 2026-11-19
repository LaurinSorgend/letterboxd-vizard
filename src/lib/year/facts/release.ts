import { datesIn, type Library } from '../library';
import { releaseYear } from '$lib/film/release';
import { daysBetween } from '../calendar';
import type { EnrichedFilm } from '$lib/types';

/** What "inside a month" means for a release reaching the viewer. */
export const MONTH_DAYS = 30;

export interface Lag {
	film: EnrichedFilm;
	days: number;
	released: string;
	watched: string;
}

/**
 * Days between release and the first viewing inside the year, per film. Festival and regional
 * screenings can predate TMDB's date, so a negative lag counts as day zero.
 */
export function releaseLags(library: Library): Lag[] {
	const lags: Lag[] = [];
	for (const film of library.slice) {
		const released = film.tmdb?.releaseDate;
		const watched = datesIn(film, library.year)[0];
		if (!released || !watched) continue;
		lags.push({ film, days: Math.max(0, daysBetween(released, watched)), released, watched });
	}
	return lags;
}

/** Years between release and watch that make a long wait. */
export const LONG_WAIT_YEARS = 20;

/** Films released before this year count as from the last millennium. */
export const MILLENNIUM = 2000;

export interface LongestWait {
	/** Films with a release date and a watch this year, the field the wait is the longest of. */
	dated: number;
	film: EnrichedFilm;
	years: number;
	released: string;
	watched: string;
	/** Films watched LONG_WAIT_YEARS or more after release. */
	longWaits: number;
}

export function longestWait(library: Library): LongestWait | null {
	const lags = releaseLags(library);
	if (lags.length === 0) return null;
	const worst = lags.reduce((slowest, lag) => (lag.days > slowest.days ? lag : slowest));
	return {
		dated: lags.length,
		film: worst.film,
		years: Math.floor(worst.days / 365.25),
		released: worst.released,
		watched: worst.watched,
		longWaits: lags.filter((lag) => lag.days / 365.25 >= LONG_WAIT_YEARS).length
	};
}

export interface QuickWatch {
	film: EnrichedFilm;
	days: number;
	released: string;
	insideMonth: number;
}

/**
 * A film watched before its TMDB release date is a festival or regional screening and is
 * excluded; `releaseLags` already clamps that case to zero, so `quickestWatch` re-derives the raw
 * difference to tell it apart from a genuine opening-day watch, which is the fastest turnaround
 * there is and must still qualify.
 */
export function quickestWatch(library: Library): QuickWatch | null {
	const eligible = releaseLags(library).filter(
		(lag) => daysBetween(lag.released, lag.watched) >= 0
	);
	if (eligible.length === 0) return null;
	const fastest = eligible.reduce((quickest, lag) => (lag.days < quickest.days ? lag : quickest));
	return {
		film: fastest.film,
		days: fastest.days,
		released: fastest.released,
		insideMonth: eligible.filter((lag) => lag.days <= MONTH_DAYS).length
	};
}

export interface Freshness {
	/** Films with a known release year. */
	dated: number;
	/** Of the year's films, the share released that same year. */
	share: number;
	thisYear: number;
	lastYear: number;
	preMillennium: number;
	/** The films released this year. */
	films: EnrichedFilm[];
}

export function freshness(library: Library): Freshness {
	const years = library.slice.map((film) => ({ film, year: releaseYear(film) }));
	const current = years.filter((entry) => entry.year === library.year).map((entry) => entry.film);
	return {
		dated: years.filter((entry) => entry.year !== null).length,
		share: library.slice.length === 0 ? 0 : current.length / library.slice.length,
		thisYear: current.length,
		lastYear: years.filter((entry) => entry.year === library.year - 1).length,
		preMillennium: years.filter((entry) => entry.year !== null && entry.year < MILLENNIUM).length,
		films: current
	};
}
