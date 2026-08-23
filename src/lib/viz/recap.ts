import { getOrCreate } from '$lib/collections';
import { effectiveCountries } from './countries';
import {
	avgRating,
	byGenre,
	byPerson,
	longestRun,
	ratingGaps,
	totalRuntimeMinutes,
	type BarDatum,
	type RatingGap,
	type Streak
} from './stats';
import { verdictFor, type Personality } from './verdicts';
import { buildLibrary, type Library } from '$lib/wrapped/library';
import type { CollectionParts, EnrichedFilm, WatchlistEntry } from '$lib/types';

export type { Personality };

/** Letterboxd's own bar for a Year in Review. Under it the numbers describe noise, not a year. */
const MIN_FILMS = 10;

/** What a recap is allowed to know beyond the films themselves. */
export interface RecapContext {
	watchlist?: WatchlistEntry[];
	collections?: CollectionParts[];
	locale?: string;
	now?: Date;
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
	/** The whole export plus the year's slice, the input every frame and verdict computes from. */
	library: Library;
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
	return longestRun(
		films.flatMap((film) => film.watchedDates).filter((date) => inYear(date, year))
	);
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

/** Everything the recap cards need for one year, or null when that year is too thin to describe. */
export function buildRecap(
	films: EnrichedFilm[],
	year: number,
	context: RecapContext = {}
): Recap | null {
	const library = buildLibrary({ films, year, ...context });
	const slice = library.slice;
	if (slice.length < MIN_FILMS) return null;

	const topDirector = byPerson(slice, 'directors')[0] ?? null;
	const avg = avgRating(slice);

	return {
		year,
		films: slice,
		watches: library.dates.length,
		hours: Math.round(totalRuntimeMinutes(slice) / 60),
		avg,
		top: [...slice]
			.filter((film) => film.rating !== null)
			.sort(
				(a, b) =>
					(b.rating ?? 0) - (a.rating ?? 0) ||
					Number(b.liked) - Number(a.liked) ||
					a.name.localeCompare(b.name)
			)
			.slice(0, 5),
		topGenre: byGenre(slice)[0] ?? null,
		topDirector,
		topActor: byPerson(slice, 'cast')[0] ?? null,
		mostObscure: extremeByVotes(slice, 'low'),
		mostPopular: extremeByVotes(slice, 'high'),
		streak: longestStreak(slice, year),
		gap: ratingGaps(slice).over[0] ?? null,
		countries: new Set(slice.flatMap((f) => (f.tmdb ? effectiveCountries(f.tmdb) : []))).size,
		languages: new Set(
			slice.map((film) => film.tmdb?.originalLanguage).filter((l): l is string => !!l)
		).size,
		library,
		personality: verdictFor(library),
		partial: year === library.now.getFullYear()
	};
}
