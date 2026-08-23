import { aggregateCountries, type CountryStat } from '$lib/viz/countries';
import { buildRecap, type Recap, type RecapContext } from '$lib/viz/recap';
import { byLanguage, ratingGaps, type BarDatum, type RatingGap } from '$lib/viz/stats';
import { datesIn, rewatchesIn } from './library';
import type { EnrichedFilm } from '$lib/types';

const MONTHS = Array.from({ length: 12 }, (_, month) =>
	new Date(Date.UTC(2000, month, 1)).toLocaleDateString('en', { month: 'long', timeZone: 'UTC' })
);

/** A film paired with the diary date that earned it its place. */
export interface DatedFilm {
	film: EnrichedFilm;
	date: string;
}

export interface BusiestDay {
	date: string;
	count: number;
	films: EnrichedFilm[];
}

/** Everything the deck shows, on top of the card recap the page already builds. */
export interface Wrapped extends Recap {
	viewer: string | null;
	days: number;
	/** Diary entries per calendar month, January first. */
	perMonth: number[];
	busiestMonth: { name: string; count: number } | null;
	busiestDay: BusiestDay | null;
	first: DatedFilm | null;
	last: DatedFilm | null;
	topGenres: BarDatum[];
	topDirectors: BarDatum[];
	topActors: BarDatum[];
	topCountries: CountryStat[];
	topLanguages: BarDatum[];
	longest: EnrichedFilm | null;
	oldest: EnrichedFilm | null;
	medianYear: number | null;
	/** Diary entries beyond the first for any film, i.e. how much of the year was a return visit. */
	rewatches: number;
	over: RatingGap | null;
	under: RatingGap | null;
}

function monthTally(films: EnrichedFilm[], year: number): number[] {
	const months = Array.from({ length: 12 }, () => 0);
	for (const film of films) {
		for (const date of datesIn(film, year)) {
			const month = Number.parseInt(date.slice(5, 7), 10) - 1;
			if (month >= 0 && month < 12) months[month] += 1;
		}
	}
	return months;
}

function peakMonth(perMonth: number[]): { name: string; count: number } | null {
	let best = -1;
	perMonth.forEach((count, month) => {
		if (best === -1 || count > perMonth[best]) best = month;
	});
	return best === -1 || perMonth[best] === 0 ? null : { name: MONTHS[best], count: perMonth[best] };
}

function busiestDay(films: EnrichedFilm[], year: number): BusiestDay | null {
	const byDate = new Map<string, EnrichedFilm[]>();
	for (const film of films) {
		for (const date of datesIn(film, year)) {
			const bucket = byDate.get(date);
			if (bucket) bucket.push(film);
			else byDate.set(date, [film]);
		}
	}
	let best: BusiestDay | null = null;
	for (const [date, watched] of byDate) {
		if (!best || watched.length > best.count || (watched.length === best.count && date < best.date))
			best = { date, count: watched.length, films: watched };
	}
	return best;
}

/** The year's first and last diary entries, so the deck can open and close on real dates. */
function bookends(
	films: EnrichedFilm[],
	year: number
): { first: DatedFilm | null; last: DatedFilm | null } {
	const dated = films
		.flatMap((film) => datesIn(film, year).map((date) => ({ film, date })))
		.sort((a, b) => a.date.localeCompare(b.date) || a.film.name.localeCompare(b.film.name));
	return { first: dated[0] ?? null, last: dated[dated.length - 1] ?? null };
}

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

function medianReleaseYear(films: EnrichedFilm[]): number | null {
	const years = films
		.map((film) => film.tmdb?.year ?? film.year)
		.filter((year): year is number => year !== null)
		.sort((a, b) => a - b);
	return years.length === 0 ? null : years[Math.floor(years.length / 2)];
}

function leadingCountries(films: EnrichedFilm[]): CountryStat[] {
	return [...aggregateCountries(films).values()]
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		.slice(0, 3);
}

/** What the deck is allowed to know beyond the films themselves. */
export interface DeckContext extends RecapContext {
	viewer?: string | null;
}

/** The full deck's data for one year, or null when that year is too thin to describe. */
export function buildWrapped(
	films: EnrichedFilm[],
	year: number,
	context: DeckContext = {}
): Wrapped | null {
	const recap = buildRecap(films, year, context);
	if (!recap) return null;

	const slice = recap.films;
	const perMonth = monthTally(slice, year);
	const gaps = ratingGaps(slice);

	return {
		...recap,
		viewer: context.viewer ?? null,
		days: Math.round(recap.hours / 24),
		perMonth,
		busiestMonth: peakMonth(perMonth),
		busiestDay: busiestDay(slice, year),
		...bookends(slice, year),
		topGenres: recap.library.genres().slice(0, 5),
		topDirectors: recap.library.directors().slice(0, 3),
		topActors: recap.library.cast().slice(0, 3),
		topCountries: leadingCountries(slice),
		topLanguages: byLanguage(slice).slice(0, 3),
		longest: extremeBy(slice, (film) => film.tmdb?.runtime ?? null, 'max'),
		oldest: extremeBy(slice, (film) => film.tmdb?.year ?? film.year, 'min'),
		medianYear: medianReleaseYear(slice),
		rewatches: rewatchesIn(slice, year),
		over: gaps.over[0] ?? null,
		under: gaps.under[0] ?? null
	};
}
