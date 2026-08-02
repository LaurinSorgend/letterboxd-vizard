import { getOrCreate } from '$lib/collections';
import { effectiveCountries } from './countries';
import {
	avgRating,
	byGenre,
	byPerson,
	obscurityShare,
	ratingGaps,
	totalRuntimeMinutes,
	type BarDatum,
	type RatingGap
} from './stats';
import type { EnrichedFilm } from '$lib/types';

/** Letterboxd's own bar for a Year in Review. Under it the numbers describe noise, not a year. */
const MIN_FILMS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Streak {
	days: number;
	start: string;
	end: string;
}

export interface Personality {
	title: string;
	detail: string;
}

export interface Recap {
	year: number;
	films: EnrichedFilm[];
	/** Diary entries, so a film watched twice in the year counts twice here but once above. */
	watches: number;
	hours: number;
	avg: number | null;
	top: EnrichedFilm[];
	topGenre: BarDatum | null;
	topDirector: BarDatum | null;
	topActor: BarDatum | null;
	mostObscure: EnrichedFilm | null;
	mostPopular: EnrichedFilm | null;
	streak: Streak | null;
	gap: RatingGap | null;
	countries: number;
	languages: number;
	personality: Personality;
	/** True while the year is still running, so the copy can say the picture is not final. */
	partial: boolean;
}

function inYear(date: string, year: number): boolean {
	return date.startsWith(`${year}-`);
}

/**
 * Years with enough diary entries to be worth a recap, newest first. The current year is held
 * back until December: a recap of a year three weeks old is a recap of nothing.
 */
export function eligibleYears(films: EnrichedFilm[], now: Date): number[] {
	const seen = new Map<number, Set<string>>();
	for (const film of films) {
		for (const date of film.watchedDates) {
			const year = Number.parseInt(date.slice(0, 4), 10);
			if (Number.isFinite(year)) getOrCreate(seen, year, () => new Set<string>()).add(film.uri);
		}
	}
	const current = now.getFullYear();
	const currentCounts = now.getMonth() === 11;
	return [...seen]
		.filter(([, logged]) => logged.size >= MIN_FILMS)
		.filter(([year]) => year < current || (year === current && currentCounts))
		.map(([year]) => year)
		.sort((a, b) => b - a);
}

/** The longest run of consecutive days you logged something. */
function longestStreak(films: EnrichedFilm[], year: number): Streak | null {
	const days = [
		...new Set(films.flatMap((film) => film.watchedDates).filter((date) => inYear(date, year)))
	].sort();
	if (days.length === 0) return null;
	let best: Streak = { days: 1, start: days[0], end: days[0] };
	let run = 1;
	for (let i = 1; i < days.length; i++) {
		run = (Date.parse(days[i]) - Date.parse(days[i - 1])) / DAY_MS === 1 ? run + 1 : 1;
		if (run > best.days) best = { days: run, start: days[i - run + 1], end: days[i] };
	}
	return best;
}

function extremeByVotes(films: EnrichedFilm[], want: 'low' | 'high'): EnrichedFilm | null {
	let best: EnrichedFilm | null = null;
	let bestVotes = want === 'low' ? Infinity : -Infinity;
	for (const film of films) {
		const votes = film.tmdb?.voteCount;
		if (votes === null || votes === undefined) continue;
		if (want === 'low' ? votes < bestVotes : votes > bestVotes) {
			bestVotes = votes;
			best = film;
		}
	}
	return best;
}

function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

interface Traits {
	year: number;
	count: number;
	months: number;
	obscure: number | null;
	medianYear: number | null;
	countries: number;
	meanRuntime: number | null;
	topDirector: BarDatum | null;
	avg: number | null;
}

/**
 * Ordered most specific first, and the first match wins, so the label is deterministic and the
 * line under it always cites the number that earned it. Nothing here renders a generic string.
 */
const RULES: { title: string; when: (t: Traits) => boolean; detail: (t: Traits) => string }[] = [
	{
		title: 'The Deep Diver',
		when: (t) => (t.obscure ?? 0) >= 0.45,
		detail: (t) =>
			`${Math.round((t.obscure ?? 0) * 100)}% of what you watched has under 1,000 TMDB ratings.`
	},
	{
		title: 'The Time Traveller',
		when: (t) => t.medianYear !== null && t.year - t.medianYear >= 25,
		detail: (t) => `Your median film came out in ${t.medianYear}.`
	},
	{
		title: 'The Globetrotter',
		when: (t) => t.countries >= 20,
		detail: (t) => `You watched films from ${t.countries} countries.`
	},
	{
		title: 'The Marathoner',
		when: (t) => (t.meanRuntime ?? 0) >= 125,
		detail: (t) => `Your average film ran ${Math.round(t.meanRuntime ?? 0)} minutes.`
	},
	{
		title: 'The Completist',
		when: (t) => (t.topDirector?.count ?? 0) >= 6,
		detail: (t) => `You watched ${t.topDirector?.count} films by ${t.topDirector?.label}.`
	},
	{
		title: 'The Generous',
		when: (t) => (t.avg ?? 0) >= 3.8,
		detail: (t) => `You averaged ★ ${(t.avg ?? 0).toFixed(2)} across the year.`
	},
	{
		title: 'The Regular',
		when: () => true,
		detail: (t) => `${t.count} films across ${t.months} months of the year.`
	}
];

function personalityOf(traits: Traits): Personality {
	const rule = RULES.find((candidate) => candidate.when(traits)) ?? RULES[RULES.length - 1];
	return { title: rule.title, detail: rule.detail(traits) };
}

/** Everything the recap cards need for one year, or null when that year is too thin to describe. */
export function buildRecap(films: EnrichedFilm[], year: number, now = new Date()): Recap | null {
	const slice = films.filter((film) => film.watchedDates.some((date) => inYear(date, year)));
	if (slice.length < MIN_FILMS) return null;

	const watchDates = slice.flatMap((film) => film.watchedDates.filter((d) => inYear(d, year)));
	const runtimes = slice.map((film) => film.tmdb?.runtime).filter((r): r is number => !!r);
	const topDirector = byPerson(slice, 'directors')[0] ?? null;
	const avg = avgRating(slice);

	const traits: Traits = {
		year,
		count: slice.length,
		months: new Set(watchDates.map((date) => date.slice(0, 7))).size,
		obscure: obscurityShare(slice),
		medianYear: median(
			slice.map((film) => film.tmdb?.year ?? film.year).filter((y): y is number => y !== null)
		),
		countries: new Set(slice.flatMap((f) => (f.tmdb ? effectiveCountries(f.tmdb) : []))).size,
		meanRuntime: runtimes.length > 0 ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length : null,
		topDirector,
		avg
	};

	return {
		year,
		films: slice,
		watches: watchDates.length,
		hours: Math.round(totalRuntimeMinutes(slice) / 60),
		avg,
		top: [...slice]
			.filter((film) => film.rating !== null)
			.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name))
			.slice(0, 5),
		topGenre: byGenre(slice)[0] ?? null,
		topDirector,
		topActor: byPerson(slice, 'cast')[0] ?? null,
		mostObscure: extremeByVotes(slice, 'low'),
		mostPopular: extremeByVotes(slice, 'high'),
		streak: longestStreak(slice, year),
		gap: ratingGaps(slice).over[0] ?? null,
		countries: traits.countries,
		languages: new Set(
			slice.map((film) => film.tmdb?.originalLanguage).filter((l): l is string => !!l)
		).size,
		personality: personalityOf(traits),
		partial: year === now.getFullYear()
	};
}
