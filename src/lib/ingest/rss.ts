import { getOrCreate } from '$lib/maps';
import { latestWatch } from '$lib/film/diary';
import { letterboxdFilmUrl } from '$lib/film/links';
import type { FeedEntry, Film } from '$lib/types';
import { blankFilm, filmKey } from './film';

/** Letterboxd's profile feed holds this many film items at most, with no way to page back. */
export const FEED_FILM_LIMIT = 50;

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
	return slug ? letterboxdFilmUrl(slug) : (link ?? '');
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

/**
 * What merging a feed changed: the library's films with the feed's viewings applied, the films
 * the feed introduced, and how many viewings it added in all.
 */
interface FeedMerge<F extends Film> {
	library: F[];
	newFilms: Film[];
	addedEntries: number;
}

function applyEntry(film: Film, entry: FeedEntry): boolean {
	if (entry.liked) film.liked = true;
	if (entry.review) film.review = entry.review;
	if (entry.rating !== null && (entry.date ?? '') >= (latestWatch(film) ?? ''))
		film.rating = entry.rating;
	if (!entry.date || film.watchedDates.includes(entry.date)) return false;
	film.watchedDates.push(entry.date);
	film.entries.push({ date: entry.date, rating: entry.rating, rewatch: entry.rewatch });
	if (entry.rewatch) film.rewatch = true;
	return true;
}

/**
 * Folds feed entries into a library, matching films as the export parser does. A viewing already
 * on record for the same date is not counted twice. Films are copied, never mutated.
 */
export function mergeFeed<F extends Film>(library: F[], feed: FeedEntry[]): FeedMerge<F> {
	const known = new Map<string, F>();
	for (const film of library) {
		known.set(filmKey(film.name, film.year), {
			...film,
			watchedDates: [...film.watchedDates],
			entries: [...film.entries]
		});
	}
	const added = new Map<string, Film>();
	let addedEntries = 0;
	for (const entry of [...feed].reverse()) {
		const key = filmKey(entry.name, entry.year);
		const film = known.get(key) ?? getOrCreate(added, key, () => blankFilm(entry));
		if (applyEntry(film, entry)) addedEntries += 1;
	}
	return { library: [...known.values()], newFilms: [...added.values()], addedEntries };
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
		const latest = latestWatch(film) ?? '';
		return latest > max ? latest : max;
	}, '');
	return newestKnown !== '' && oldestInFeed > newestKnown;
}
