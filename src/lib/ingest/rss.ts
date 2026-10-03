import { getOrCreate } from '$lib/collections';
import type { Film } from '$lib/types';

/** Letterboxd's profile feed holds this many film items at most, with no way to page back. */
export const FEED_FILM_LIMIT = 50;

/** One film item of a member's RSS feed: a diary entry, or a review with its viewing. */
export interface FeedEntry {
	/** Canonical film page, without the member or the repeat-viewing suffix. */
	uri: string;
	name: string;
	year: number | null;
	/** ISO watch date; null for a review logged without one. */
	date: string | null;
	rating: number | null;
	rewatch: boolean;
	liked: boolean;
	review: string | null;
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
		if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole;
		const point = code[1] === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
		return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
	});
}

function tag(item: string, name: string): string | null {
	const match = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
	if (!match) return null;
	return match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}

/** The review paragraphs of a description, minus the poster and spoiler notice. */
function reviewText(description: string | null): string | null {
	if (!description) return null;
	const paragraphs = [...description.matchAll(/<p>([\s\S]*?)<\/p>/g)]
		.map((match) => decodeEntities(match[1].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')))
		.map((text) => text.trim())
		.filter((text) => text && !/^This review may contain spoilers\.?$/.test(text));
	return paragraphs.length > 0 ? paragraphs.join('\n\n') : null;
}

function canonicalUri(link: string | null): string {
	const slug = link?.match(/\/film\/([^/]+)\//)?.[1];
	return slug ? `https://letterboxd.com/film/${slug}/` : (link ?? '');
}

function parseItem(item: string): FeedEntry | null {
	const name = tag(item, 'letterboxd:filmTitle');
	if (!name) return null;
	const year = Number.parseInt(tag(item, 'letterboxd:filmYear') ?? '', 10);
	const rating = Number.parseFloat(tag(item, 'letterboxd:memberRating') ?? '');
	const isReview = /letterboxd-review-/.test(tag(item, 'guid') ?? '');
	return {
		uri: canonicalUri(tag(item, 'link')),
		name: decodeEntities(name),
		year: Number.isFinite(year) ? year : null,
		date: tag(item, 'letterboxd:watchedDate'),
		rating: Number.isFinite(rating) ? rating : null,
		rewatch: tag(item, 'letterboxd:rewatch') === 'Yes',
		liked: tag(item, 'letterboxd:memberLike') === 'Yes',
		review: isReview ? reviewText(tag(item, 'description')) : null
	};
}

/** Reads the film items out of a Letterboxd profile feed, newest first; list items are skipped. */
export function parseFeed(xml: string): FeedEntry[] {
	return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
		.map((match) => parseItem(match[1]))
		.filter((entry): entry is FeedEntry => entry !== null);
}

/** What merging a feed changed: films it introduced, and how many viewings it added in all. */
export interface FeedMerge<F extends Film> {
	films: F[];
	newFilms: F[];
	addedEntries: number;
}

function blankFilm(entry: FeedEntry): Film {
	return {
		uri: entry.uri,
		name: entry.name,
		year: entry.year,
		rating: null,
		liked: false,
		review: null,
		watchedDates: [],
		entries: [],
		rewatch: false,
		tags: []
	};
}

function latestDate(film: Film): string {
	return film.watchedDates.reduce((max, date) => (date > max ? date : max), '');
}

function applyEntry(film: Film, entry: FeedEntry): boolean {
	if (entry.liked) film.liked = true;
	if (entry.review) film.review = entry.review;
	if (entry.rating !== null && (entry.date ?? '') >= latestDate(film)) film.rating = entry.rating;
	if (!entry.date || film.watchedDates.includes(entry.date)) return false;
	film.watchedDates.push(entry.date);
	film.entries.push({ date: entry.date, rating: entry.rating, rewatch: entry.rewatch });
	if (entry.rewatch) film.rewatch = true;
	return true;
}

/**
 * Folds feed entries into a library, matching films by name and year as the export parser
 * does. A viewing already on record for the same date is not counted twice. Films are copied,
 * never mutated; `makeFilm` shapes the films the feed introduces.
 */
export function mergeFeed<F extends Film>(
	library: F[],
	feed: FeedEntry[],
	makeFilm: (film: Film) => F
): FeedMerge<F> {
	const byKey = new Map<string, F>();
	for (const film of library) {
		byKey.set(`${film.name}::${film.year}`, {
			...film,
			watchedDates: [...film.watchedDates],
			entries: [...film.entries]
		});
	}
	const known = new Set(byKey.keys());
	let addedEntries = 0;
	for (const entry of [...feed].reverse()) {
		const film = getOrCreate(byKey, `${entry.name}::${entry.year}`, () =>
			makeFilm(blankFilm(entry))
		);
		if (applyEntry(film, entry)) addedEntries += 1;
	}
	const newFilms = [...byKey].filter(([key]) => !known.has(key)).map(([, film]) => film);
	return { films: [...byKey.values()], newFilms, addedEntries };
}

/**
 * True when a full feed starts after the library's last diary date, so viewings logged in
 * between fell off the feed and only a fresh export can recover them.
 */
export function feedHasGap(library: Film[], feed: FeedEntry[]): boolean {
	const dated = feed.map((entry) => entry.date).filter((date): date is string => !!date);
	if (feed.length < FEED_FILM_LIMIT || dated.length === 0) return false;
	const oldestInFeed = dated.reduce((min, date) => (date < min ? date : min));
	const newestKnown = library.reduce((max, film) => {
		const latest = latestDate(film);
		return latest > max ? latest : max;
	}, '');
	return newestKnown !== '' && oldestInFeed > newestKnown;
}
