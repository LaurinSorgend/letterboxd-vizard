import {
	biggestCollection,
	directorBreadth,
	likedNotLoved,
	topTag,
	watchlistAge,
	watchlistMaths,
	writing
} from '../facts/library-facts';
import { longDate } from '../facts/dates';
import { formatDays } from '$lib/viz/stats';
import { count, plural, posterOf, stars, type Scene } from './shared';
import type { Wrapped } from '../wrapped';

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Small counts read better as words inside a sentence; anything larger stays a numeral. */
function spell(n: number): string {
	return n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : count(n);
}

/** Words and digits do not mix inside one phrase, so a pair falls back together. */
function spellPair(a: number, b: number): [string, string] {
	return a < NUMBER_WORDS.length && b < NUMBER_WORDS.length
		? [spell(a), spell(b)]
		: [count(a), count(b)];
}

export function writingScene(data: Wrapped): Scene | null {
	const written = writing(data.library);
	// A whitespace-only review still counts as written but contributes no words; without this
	// guard the frame could headline a literal zero, which the drop-out rule forbids.
	if (!written || written.words === 0) return null;
	return {
		id: 'words',
		accent: 'neutral',
		label: 'Words written',
		value: count(written.words),
		valueKind: 'number',
		note: `${plural(written.reviews, 'review')}, ${plural(written.words, 'word')}.${written.longest ? ` The longest ran to ${plural(written.longest.words, 'word')}, on ${written.longest.film.name}.` : ''}`,
		stats: [
			{ label: 'Reviews', value: count(written.reviews) },
			{ label: 'Longest', value: plural(written.longest?.words ?? 0, 'word') },
			{ label: 'Left in silence', value: count(written.silent) }
		],
		body: { kind: 'none' }
	};
}

export function watchlistScene(data: Wrapped): Scene | null {
	const maths = watchlistMaths(data.library);
	if (!maths) return null;
	return {
		id: 'watchlist',
		accent: 'forest',
		label: 'Watchlist arithmetic',
		value: maths.years.toFixed(1),
		valueKind: 'number',
		note: `${plural(maths.size, 'film')} on your watchlist. At ${count(maths.watched)} a year, and assuming you never add another, that is ${maths.years.toFixed(1)} years of viewing.`,
		stats: [
			{ label: 'On the watchlist', value: count(maths.size) },
			{ label: 'Watched this year', value: count(maths.watched) },
			{ label: 'Added this year', value: count(maths.addedThisYear) }
		],
		body: { kind: 'none' }
	};
}

export function watchlistAgeScene(data: Wrapped): Scene | null {
	const age = watchlistAge(data.library);
	if (!age) return null;
	return {
		id: 'watchlist-age',
		accent: 'forest',
		label: 'Longest on the list',
		value: age.oldest.name,
		valueKind: 'name',
		note: `You added it on ${longDate(age.oldest.added, data.year)} and have not watched it since. That is ${formatDays(age.oldest.days)} of good intentions.`,
		stats: [
			{ label: 'Added', value: longDate(age.oldest.added, data.year) },
			{ label: 'Waiting', value: formatDays(age.oldest.days) },
			{ label: 'Median age', value: formatDays(age.medianDays) }
		],
		body: { kind: 'none' }
	};
}

export function breadthScene(data: Wrapped): Scene | null {
	const breadth = directorBreadth(data.library);
	if (!breadth) return null;
	return {
		id: 'breadth',
		accent: 'indigo',
		label: 'Breadth against depth',
		value: String(breadth.directors),
		valueKind: 'number',
		note: `${plural(breadth.directors, 'director')} across ${plural(data.films.length, 'film')}. You went back to ${spell(breadth.repeat)} of them.`,
		stats: [
			{ label: 'Seen more than once', value: String(breadth.repeat) },
			{ label: 'Four or more', value: String(breadth.deep) },
			{ label: 'Most watched', value: `${breadth.top.name}, ${breadth.top.count}` }
		],
		body: { kind: 'none' }
	};
}

export function likedScene(data: Wrapped): Scene | null {
	const liked = likedNotLoved(data.library);
	if (!liked) return null;
	const others =
		liked.heartsUnderFour > 1
			? ` ${plural(liked.heartsUnderFour - 1, 'other film')} got a heart without four stars.`
			: '';
	return {
		id: 'liked',
		accent: 'magenta',
		label: 'Liked, not loved',
		value: liked.film.name,
		valueKind: 'name',
		note: `You hearted it and gave it ${stars(liked.rating)}.${others}`,
		stats: [
			{ label: 'Rating', value: stars(liked.rating) },
			{ label: 'Hearts this year', value: String(liked.hearts) },
			{ label: 'Hearts under ★ 4', value: String(liked.heartsUnderFour) }
		],
		body: { kind: 'posters', posters: [posterOf(liked.film, stars(liked.rating))] }
	};
}

export function collectionScene(data: Wrapped): Scene | null {
	const worked = biggestCollection(data.library);
	if (!worked) return null;
	const seen = worked.seen;
	const [ofSeen, ofTotal] = spellPair(seen, worked.total ?? 0);
	const covered = worked.total
		? `${ofSeen} of the ${ofTotal} films in the ${worked.name} collection`
		: `${spell(seen)} films from the ${worked.name} collection`;
	return {
		id: 'collection',
		accent: 'oxblood',
		label: 'The set you worked through',
		value: worked.name,
		valueKind: 'name',
		note: `${covered[0].toUpperCase()}${covered.slice(1)}, between ${longDate(worked.first, data.year)} and ${longDate(worked.last, data.year)}.`,
		stats: [
			{ label: 'Films', value: worked.total ? `${seen} of ${worked.total}` : String(seen) },
			{ label: 'First', value: longDate(worked.first, data.year) },
			{ label: 'Last', value: longDate(worked.last, data.year) }
		],
		body: { kind: 'posters', posters: worked.shownFilms.map((film) => posterOf(film, '')) }
	};
}

export function tagScene(data: Wrapped): Scene | null {
	const tag = topTag(data.library);
	if (!tag) return null;
	return {
		id: 'tag',
		accent: 'neutral',
		label: 'The tag',
		value: tag.tag,
		valueKind: 'name',
		note: `You tagged ${plural(tag.count, 'film')} "${tag.tag}", out of ${plural(tag.tagged, 'tagged film')} in all.`,
		stats: [
			{ label: 'Tags used', value: String(tag.distinct) },
			{ label: 'Most used', value: `${tag.tag}, ${tag.count}` },
			{ label: 'Tagged films', value: String(tag.tagged) }
		],
		body: { kind: 'none' }
	};
}
