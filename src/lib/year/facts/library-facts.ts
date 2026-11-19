import { getOrCreate } from '$lib/maps';
import { median } from '$lib/math';
import { grouped } from '$lib/film/tally';
import { datesIn, todayIso, type Library } from '../library';
import { daysBetween, inYear } from '../calendar';
import { collectionName } from '$lib/format';
import type { EnrichedFilm, WatchlistEntry } from '$lib/types';

export interface Writing {
	reviews: number;
	words: number;
	longest: { film: EnrichedFilm; words: number };
	silent: number;
}

function wordCount(review: string): number {
	return review.trim().split(/\s+/).filter(Boolean).length;
}

/** Reviews belong to the film, not the viewing, so a review counts for the year it was watched. */
export function writing(library: Library): Writing | null {
	const counted = library.slice.flatMap((film) =>
		film.review ? [{ film, words: wordCount(film.review) }] : []
	);
	if (counted.length === 0) return null;
	return {
		reviews: counted.length,
		words: counted.reduce((sum, entry) => sum + entry.words, 0),
		longest: counted.reduce((most, entry) => (entry.words > most.words ? entry : most)),
		silent: library.slice.length - counted.length
	};
}

export interface WatchlistMaths {
	size: number;
	watched: number;
	/** How many years the queue would take at this year's rate. */
	years: number;
	addedThisYear: number;
}

export function watchlistMaths(library: Library): WatchlistMaths {
	const size = library.watchlist.length;
	const watched = library.slice.length;
	return {
		size,
		watched,
		years: watched === 0 ? Infinity : size / watched,
		addedThisYear: library.watchlist.filter(
			(entry) => entry.added !== null && inYear(entry.added, library.year)
		).length
	};
}

export interface WatchlistAge {
	/** Unwatched entries with an added date, the population the ages are taken over. */
	dated: number;
	oldest: { name: string; added: string; days: number };
	medianDays: number;
}

export function watchlistAge(library: Library): WatchlistAge | null {
	// The frame says "and have not watched it since", so a watchlist row for a film already in
	// the diary cannot be the winner. Letterboxd exports keep such rows until they are removed.
	const seen = new Set(library.all.map((film) => film.uri));
	const dated = library.watchlist.filter(
		(entry) => entry.added !== null && !seen.has(entry.uri)
	) as (WatchlistEntry & {
		added: string;
	})[];
	if (dated.length === 0) return null;
	const today = todayIso(library);
	const ages = dated
		.map((entry) => ({ entry, days: daysBetween(entry.added, today) }))
		.sort((a, b) => b.days - a.days);
	const oldest = ages[0];
	return {
		dated: dated.length,
		oldest: { name: oldest.entry.name, added: oldest.entry.added, days: oldest.days },
		medianDays: median(ages.map((age) => age.days)) as number
	};
}

/** Films by one director in a year that count as going deep into their work. */
export const DEEP_FILMS = 4;

export interface Breadth {
	/** Films with a director on record. */
	directed: number;
	directors: number;
	repeat: number;
	/** Directors with DEEP_FILMS or more films in the year. */
	deep: number;
	top: { name: string; count: number };
}

export function directorBreadth(library: Library): Breadth | null {
	const people = library.directors();
	if (people.length === 0) return null;
	return {
		directed: library.slice.filter((film) => (film.tmdb?.directors.length ?? 0) > 0).length,
		directors: people.length,
		repeat: people.filter((person) => person.count >= 2).length,
		deep: people.filter((person) => person.count >= DEEP_FILMS).length,
		top: { name: people[0].label, count: people[0].count }
	};
}

/** Stars at which a rating reads as loving the film. */
export const LOVED = 4;

export interface LikedNotLoved {
	/** The lowest-rated film you hearted. */
	film: EnrichedFilm;
	rating: number;
	hearts: number;
	heartsUnderLoved: number;
}

export function likedNotLoved(library: Library): LikedNotLoved | null {
	const hearted = library.slice.filter((film) => film.liked);
	const rated = hearted.flatMap((film) =>
		film.rating === null ? [] : [{ film, rating: film.rating }]
	);
	if (rated.length === 0) return null;
	const lowest = rated.reduce((low, entry) => (entry.rating < low.rating ? entry : low));
	return {
		film: lowest.film,
		rating: lowest.rating,
		hearts: hearted.length,
		heartsUnderLoved: rated.filter((entry) => entry.rating < LOVED).length
	};
}

export interface Worked {
	name: string;
	/** How many of the franchise's films the year covered. */
	seen: number;
	films: EnrichedFilm[];
	first: string;
	last: string;
	/** How many films TMDB lists in the franchise, or null when the size was never fetched. */
	total: number | null;
}

export function biggestCollection(library: Library): Worked | null {
	const groups = new Map<number, EnrichedFilm[]>();
	for (const film of library.slice) {
		const collection = film.tmdb?.collection;
		if (collection) getOrCreate(groups, collection.id, () => []).push(film);
	}
	const biggest = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
	if (!biggest) return null;

	const [id, films] = biggest;
	const dates = films.flatMap((film) => datesIn(film, library.year)).sort();
	const raw = films[0].tmdb?.collection?.name ?? '';
	return {
		name: collectionName(library.collections.get(id)?.name ?? raw),
		seen: films.length,
		films,
		first: dates[0],
		last: dates[dates.length - 1],
		total: library.collections.get(id)?.total ?? null
	};
}

export interface TopTag {
	tag: string;
	count: number;
	distinct: number;
	tagged: number;
}

export function topTag(library: Library): TopTag | null {
	const ranked = grouped(library.slice, (film) => film.tags);
	if (ranked.length === 0) return null;
	return {
		tag: ranked[0].label,
		count: ranked[0].count,
		distinct: ranked.length,
		tagged: library.slice.filter((film) => film.tags.length > 0).length
	};
}
