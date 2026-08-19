import { getOrCreate } from '$lib/collections';
import { byPerson, type BarDatum } from '$lib/viz/stats';
import { datesIn, entriesIn, type Library } from '../library';
import type { EnrichedFilm } from '$lib/types';

const MIN_RATED = 20;
const MIN_DRIFT = 1;

export interface YearCount {
	year: number;
	count: number;
}

/** Distinct films logged per calendar year across the whole export, empty years included. */
export function filmsPerYear(library: Library): YearCount[] {
	const perYear = new Map<number, Set<string>>();
	for (const film of library.all) {
		for (const date of film.watchedDates) {
			const year = Number.parseInt(date.slice(0, 4), 10);
			if (Number.isFinite(year)) getOrCreate(perYear, year, () => new Set<string>()).add(film.uri);
		}
	}
	if (perYear.size === 0) return [];
	const years = [...perYear.keys()];
	const counts: YearCount[] = [];
	for (let year = Math.min(...years); year <= Math.max(...years); year++) {
		counts.push({ year, count: perYear.get(year)?.size ?? 0 });
	}
	return counts;
}

export interface MostLogged {
	film: EnrichedFilm;
	total: number;
	first: string;
	thisYear: number;
	runnerUp: number;
}

/** The film with the most diary entries in the export, provided it came round again this year. */
export function mostLogged(library: Library): MostLogged | null {
	const ranked = [...library.all]
		.filter((film) => film.watchedDates.length >= 3)
		.sort((a, b) => b.watchedDates.length - a.watchedDates.length || a.name.localeCompare(b.name));
	const winner = ranked[0];
	if (!winner) return null;
	const thisYear = datesIn(winner, library.year).length;
	if (thisYear === 0) return null;
	return {
		film: winner,
		total: winner.watchedDates.length,
		first: [...winner.watchedDates].sort()[0],
		thisYear,
		runnerUp: ranked[1]?.watchedDates.length ?? 0
	};
}

/** The rating recorded when the film was watched that year, falling back to its current rating. */
export function ratingInYear(film: EnrichedFilm, year: number): number | null {
	const entries = entriesIn(film, year);
	if (entries.length === 0) return null;
	const rated = entries.filter((entry) => entry.rating !== null);
	return rated.length > 0 ? rated[rated.length - 1].rating : film.rating;
}

export interface FiveStars {
	count: number;
	share: number;
	lastYear: number | null;
	/** The half-star step used most often, so the top rating has something to sit against. */
	modal: number | null;
	films: EnrichedFilm[];
}

function ratingsIn(library: Library, year: number): number[] {
	return library.all
		.map((film) => ratingInYear(film, year))
		.filter((rating): rating is number => rating !== null);
}

export function fiveStars(library: Library): FiveStars | null {
	const ratings = ratingsIn(library, library.year);
	if (ratings.length < MIN_RATED) return null;
	const previous = ratingsIn(library, library.year - 1);
	const tally = new Map<number, number>();
	for (const rating of ratings) tally.set(rating, (tally.get(rating) ?? 0) + 1);
	const modal = [...tally].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;
	const top = library.slice.filter((film) => ratingInYear(film, library.year) === 5);
	return {
		count: top.length,
		share: top.length / ratings.length,
		lastYear: previous.length > 0 ? previous.filter((rating) => rating === 5).length : null,
		modal,
		films: top.slice(0, 6)
	};
}

export interface FirstTimers {
	directors: number;
	top: { name: string; count: number } | null;
	films: EnrichedFilm[];
	byFirstTimers: number;
}

/**
 * Directors with no diary entry before this year. Films the export never dated cannot be placed
 * in time, so they are not taken as evidence of an earlier viewing.
 */
export function firstTimeDirectors(library: Library): FirstTimers | null {
	const startsBefore = (film: EnrichedFilm) =>
		film.watchedDates.some((date) => date < `${library.year}-01-01`);
	const priorFilms = library.all.filter(startsBefore);
	if (priorFilms.length === 0) return null;
	const seenBefore = new Set(
		priorFilms
			.flatMap((film) => film.tmdb?.directors ?? [])
			.map((person) => person.tmdbId ?? person.name)
	);

	// A BarDatum only carries the group's label, not its person key, so recover it from one of the
	// group's own films rather than asking whether any co-director on those films was seen before.
	const keyOf = (datum: BarDatum) => {
		const person = datum.films
			.flatMap((film) => film.tmdb?.directors ?? [])
			.find((p) => p.name === datum.label);
		return person ? (person.tmdbId ?? person.name) : datum.label;
	};
	const fresh = byPerson(library.slice, 'directors').filter(
		(datum) => !seenBefore.has(keyOf(datum))
	);
	if (fresh.length === 0) return null;
	const films = [...new Set(fresh.flatMap((datum) => datum.films))];
	return {
		directors: fresh.length,
		top: { name: fresh[0].label, count: fresh[0].count },
		films: [...films]
			.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name))
			.slice(0, 6),
		byFirstTimers: films.length
	};
}

export interface Drift {
	film: EnrichedFilm;
	before: { rating: number; date: string };
	after: { rating: number; date: string };
	delta: number;
	rethought: number;
}

function driftOf(film: EnrichedFilm, year: number): Drift | null {
	const rated = [...film.entries]
		.filter((entry) => entry.rating !== null)
		.sort((a, b) => a.date.localeCompare(b.date));
	if (rated.length < 2) return null;
	const first = rated[0];
	const last = rated[rated.length - 1];
	if (!last.date.startsWith(`${year}-`) || first.date === last.date) return null;
	return {
		film,
		before: { rating: first.rating as number, date: first.date },
		after: { rating: last.rating as number, date: last.date },
		delta: (last.rating as number) - (first.rating as number),
		rethought: 0
	};
}

/** The film whose rating moved furthest between its first recorded viewing and this year's. */
export function ratingDrift(library: Library): Drift | null {
	const drifts = library.all
		.map((film) => driftOf(film, library.year))
		.filter((drift): drift is Drift => drift !== null);
	const rethought = drifts.filter((drift) => drift.delta !== 0).length;
	const widest = drifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
	if (!widest || Math.abs(widest.delta) < MIN_DRIFT) return null;
	return { ...widest, rethought };
}
