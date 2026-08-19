import { datesIn, type Library } from '../library';
import { daysBetween } from './dates';
import type { EnrichedFilm } from '$lib/types';

/** Twenty films with a release date is the floor at which a share is worth quoting. */
const MIN_DATED = 20;
const MIN_WAIT_YEARS = 5;
const QUICK_DAYS = 30;

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

export interface LongestWait {
	film: EnrichedFilm;
	years: number;
	released: string;
	watched: string;
	overTwenty: number;
}

export function longestWait(library: Library): LongestWait | null {
	const lags = releaseLags(library);
	if (lags.length === 0) return null;
	const worst = lags.reduce((slowest, lag) => (lag.days > slowest.days ? lag : slowest));
	const years = Math.floor(worst.days / 365.25);
	if (years < MIN_WAIT_YEARS) return null;
	return {
		film: worst.film,
		years,
		released: worst.released,
		watched: worst.watched,
		overTwenty: lags.filter((lag) => lag.days / 365.25 >= 20).length
	};
}

export interface QuickWatch {
	film: EnrichedFilm;
	days: number;
	released: string;
	insideThirty: number;
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
	if (fastest.days > QUICK_DAYS) return null;
	return {
		film: fastest.film,
		days: fastest.days,
		released: fastest.released,
		insideThirty: eligible.filter((lag) => lag.days <= QUICK_DAYS).length
	};
}

export interface Freshness {
	share: number;
	thisYear: number;
	lastYear: number;
	preMillennium: number;
	/** Capped at six for the poster row; count with `thisYear`. */
	shownFilms: EnrichedFilm[];
}

function releaseYearOf(film: EnrichedFilm): number | null {
	const iso = film.tmdb?.releaseDate;
	return iso ? Number.parseInt(iso.slice(0, 4), 10) : null;
}

export function freshness(library: Library): Freshness | null {
	const dated = library.slice.filter((film) => releaseYearOf(film) !== null);
	if (dated.length < MIN_DATED) return null;
	const current = dated.filter((film) => releaseYearOf(film) === library.year);
	if (current.length < 3) return null;
	return {
		share: current.length / library.slice.length,
		thisYear: current.length,
		lastYear: dated.filter((film) => releaseYearOf(film) === library.year - 1).length,
		preMillennium: dated.filter((film) => (releaseYearOf(film) ?? 0) < 2000).length,
		shownFilms: [...current]
			.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name))
			.slice(0, 6)
	};
}
