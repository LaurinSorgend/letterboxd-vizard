import { getOrCreate } from '$lib/collections';
import { byPerson } from '$lib/viz/stats';
import { datesIn, type Library } from '../library';
import { daysBetween } from './dates';
import type { EnrichedFilm, WatchlistEntry } from '$lib/types';

const MIN_REVIEWS = 3;
const MIN_WATCHLIST = 25;
const MIN_WATCHED = 12;
const MIN_DIRECTED = 15;
const MIN_LIKED = 5;
const LIKED_CEILING = 3.5;
const MIN_TAG_USES = 5;

export interface Writing {
	reviews: number;
	words: number;
	longest: { film: EnrichedFilm; words: number } | null;
	silent: number;
}

function wordCount(review: string): number {
	return review.trim().split(/\s+/).filter(Boolean).length;
}

/** Reviews belong to the film, not the viewing, so a review counts for the year it was watched. */
export function writing(library: Library): Writing | null {
	const reviewed = library.slice.filter((film) => film.review);
	if (reviewed.length < MIN_REVIEWS) return null;
	const counted = reviewed.map((film) => ({ film, words: wordCount(film.review as string) }));
	return {
		reviews: reviewed.length,
		words: counted.reduce((sum, entry) => sum + entry.words, 0),
		longest: counted.reduce((most, entry) => (entry.words > most.words ? entry : most)),
		silent: library.slice.length - reviewed.length
	};
}

export interface WatchlistMaths {
	size: number;
	watched: number;
	/** How many years the queue would take at this year's rate. */
	years: number;
	addedThisYear: number;
}

export function watchlistMaths(library: Library): WatchlistMaths | null {
	const size = library.watchlist.length;
	const watched = library.slice.length;
	if (size < MIN_WATCHLIST || watched < MIN_WATCHED) return null;
	return {
		size,
		watched,
		years: size / watched,
		addedThisYear: library.watchlist.filter((entry) => entry.added?.startsWith(`${library.year}-`))
			.length
	};
}

export interface WatchlistAge {
	oldest: { name: string; added: string; days: number };
	medianDays: number;
	/** How many entries carry a date at all. */
	sized: number;
}

export function watchlistAge(library: Library): WatchlistAge | null {
	const dated = library.watchlist.filter((entry) => entry.added !== null) as (WatchlistEntry & {
		added: string;
	})[];
	if (dated.length < MIN_WATCHLIST) return null;
	const today = library.now.toISOString().slice(0, 10);
	const ages = dated
		.map((entry) => ({ entry, days: daysBetween(entry.added, today) }))
		.sort((a, b) => b.days - a.days);
	const oldest = ages[0];
	// Ascending, matching recap.ts's and stats.ts's median convention (upper middle on a tie).
	const ascending = ages.map((age) => age.days).sort((a, b) => a - b);
	return {
		oldest: { name: oldest.entry.name, added: oldest.entry.added, days: oldest.days },
		medianDays: ascending[Math.floor(ascending.length / 2)],
		sized: dated.length
	};
}

export interface Breadth {
	directors: number;
	repeat: number;
	deep: number;
	top: { name: string; count: number };
}

export function directorBreadth(library: Library): Breadth | null {
	const people = byPerson(library.slice, 'directors');
	const directed = library.slice.filter((film) => (film.tmdb?.directors.length ?? 0) > 0);
	if (directed.length < MIN_DIRECTED) return null;
	const deep = people.filter((person) => person.count >= 4);
	if (deep.length === 0) return null;
	return {
		directors: people.length,
		repeat: people.filter((person) => person.count >= 2).length,
		deep: deep.length,
		top: { name: people[0].label, count: people[0].count }
	};
}

export interface LikedNotLoved {
	film: EnrichedFilm;
	rating: number;
	hearts: number;
	heartsUnderFour: number;
}

export function likedNotLoved(library: Library): LikedNotLoved | null {
	const hearted = library.slice.filter((film) => film.liked);
	if (hearted.length < MIN_LIKED) return null;
	const rated = hearted.filter((film) => film.rating !== null);
	if (rated.length === 0) return null;
	const lowest = rated.reduce((low, film) => ((film.rating ?? 5) < (low.rating ?? 5) ? film : low));
	if ((lowest.rating ?? 5) >= LIKED_CEILING) return null;
	return {
		film: lowest,
		rating: lowest.rating as number,
		hearts: hearted.length,
		heartsUnderFour: rated.filter((film) => (film.rating ?? 5) < 4).length
	};
}

export interface Worked {
	id: number;
	name: string;
	/** How many of the franchise's films the year actually covered, before the poster cap. */
	seen: number;
	/** Capped at six for the poster row; count with `seen`. */
	shownFilms: EnrichedFilm[];
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
	if (!biggest || biggest[1].length < 3) return null;

	const [id, films] = biggest;
	const dates = films.flatMap((film) => datesIn(film, library.year)).sort();
	const raw = films[0].tmdb?.collection?.name ?? '';
	return {
		id,
		// TMDB names every franchise "<name> Collection", which reads as noise on a slide.
		name: library.collections.get(id)?.name ?? raw.replace(/ Collection$/, ''),
		seen: films.length,
		shownFilms: [...films].sort((a, b) => (a.tmdb?.year ?? 0) - (b.tmdb?.year ?? 0)).slice(0, 6),
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
	const counts = new Map<string, number>();
	for (const film of library.slice) {
		for (const tag of new Set(film.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	if (ranked.length === 0 || ranked[0][1] < MIN_TAG_USES) return null;
	return {
		tag: ranked[0][0],
		count: ranked[0][1],
		distinct: ranked.length,
		tagged: library.slice.filter((film) => film.tags.length > 0).length
	};
}
