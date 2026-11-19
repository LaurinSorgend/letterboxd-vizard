import {
	biggestCollection,
	DEEP_FILMS,
	directorBreadth,
	LOVED,
	likedNotLoved,
	topTag,
	watchlistAge,
	watchlistMaths,
	writing
} from '$lib/year/facts/library-facts';
import { datePair, longDate } from './prose';
import { releaseYear } from '$lib/film/release';
import {
	count,
	formatDays,
	numberWord,
	plural,
	spell,
	SPELLED_BELOW,
	starCaption,
	stars
} from '$lib/format';
import { posterOf, posterRow, type DeckInput, type Scene } from './shared';

const MIN_REVIEWS = 3;
const MIN_WATCHLIST = 25;
const MIN_WATCHED = 12;
const MIN_DIRECTED = 15;
/** Directors with DEEP_FILMS films the frame needs. */
const MIN_DEEP = 1;
const MIN_LIKED = 5;
/** A heart on anything rated this low is a heart for something other than the film. */
const LIKED_CEILING = 3.5;
/** A franchise needs three films before it reads as worked through. */
const MIN_SET = 3;
const MIN_TAG_USES = 5;

/** Words and digits do not mix inside one phrase, so a pair falls back together. */
function spellPair(a: number, b: number): [string, string] {
	return a < SPELLED_BELOW && b < SPELLED_BELOW ? [spell(a), spell(b)] : [count(a), count(b)];
}

const capitalised = (text: string): string => `${text[0].toUpperCase()}${text.slice(1)}`;

export function writingScene({ library }: DeckInput): Scene | null {
	const written = writing(library);
	// A whitespace-only review still counts as written but contributes no words, and the frame
	// must not headline a zero.
	if (!written || written.reviews < MIN_REVIEWS || written.words === 0) return null;
	return {
		id: 'words',
		accent: 'neutral',
		label: 'Words written',
		value: count(written.words),
		valueKind: 'number',
		note: `${plural(written.reviews, 'review')}, ${plural(written.words, 'word')}. The longest ran to ${plural(written.longest.words, 'word')}, on ${written.longest.film.name}.`,
		stats: [
			{ label: 'Reviews', value: count(written.reviews) },
			{ label: 'Longest', value: plural(written.longest.words, 'word') },
			{ label: 'Left in silence', value: count(written.silent) }
		],
		body: { kind: 'none' }
	};
}

export function watchlistScene({ library }: DeckInput): Scene | null {
	const maths = watchlistMaths(library);
	if (maths.size < MIN_WATCHLIST || maths.watched < MIN_WATCHED) return null;
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

export function watchlistAgeScene({ library }: DeckInput): Scene | null {
	const age = watchlistAge(library);
	if (!age || age.dated < MIN_WATCHLIST) return null;
	return {
		id: 'watchlist-age',
		accent: 'forest',
		label: 'Longest on the list',
		value: age.oldest.name,
		valueKind: 'name',
		note: `You added it on ${longDate(age.oldest.added, library.year)} and have not watched it since. That is ${formatDays(age.oldest.days)} of good intentions.`,
		stats: [
			{ label: 'Added', value: longDate(age.oldest.added, library.year) },
			{ label: 'Waiting', value: formatDays(age.oldest.days) },
			{ label: 'Median age', value: formatDays(age.medianDays) }
		],
		body: { kind: 'none' }
	};
}

export function breadthScene({ library }: DeckInput): Scene | null {
	const breadth = directorBreadth(library);
	if (!breadth || breadth.directed < MIN_DIRECTED || breadth.deep < MIN_DEEP) return null;
	return {
		id: 'breadth',
		accent: 'indigo',
		label: 'Breadth against depth',
		value: String(breadth.directors),
		valueKind: 'number',
		note: `${plural(breadth.directors, 'director')} across ${plural(library.slice.length, 'film')}. You went back to ${spell(breadth.repeat)} of them.`,
		stats: [
			{ label: 'Seen more than once', value: String(breadth.repeat) },
			{ label: `${capitalised(numberWord(DEEP_FILMS))} or more`, value: String(breadth.deep) },
			{ label: 'Most watched', value: `${breadth.top.name}, ${breadth.top.count}` }
		],
		body: { kind: 'none' }
	};
}

export function likedScene({ library }: DeckInput): Scene | null {
	const liked = likedNotLoved(library);
	if (!liked || liked.hearts < MIN_LIKED || liked.rating >= LIKED_CEILING) return null;
	// The lowest-rated heart is one of those under LOVED whenever it sits under the ceiling.
	const others = liked.heartsUnderLoved - (liked.rating < LOVED ? 1 : 0);
	const othersLine =
		others > 0
			? ` ${plural(others, 'other film')} got a heart without ${numberWord(LOVED)} stars.`
			: '';
	return {
		id: 'liked',
		accent: 'magenta',
		label: 'Liked, not loved',
		value: liked.film.name,
		valueKind: 'name',
		note: `You hearted it and gave it ${stars(liked.rating)}.${othersLine}`,
		stats: [
			{ label: 'Rating', value: stars(liked.rating) },
			{ label: 'Hearts this year', value: String(liked.hearts) },
			{ label: `Hearts under ${starCaption(LOVED)}`, value: String(liked.heartsUnderLoved) }
		],
		body: { kind: 'posters', posters: [posterOf(liked.film, stars(liked.rating))] }
	};
}

export function collectionScene({ library }: DeckInput): Scene | null {
	const worked = biggestCollection(library);
	if (!worked || worked.seen < MIN_SET) return null;
	const seen = worked.seen;
	const [first, last] = datePair(worked.first, worked.last, library.year);
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
		note: `${covered[0].toUpperCase()}${covered.slice(1)}, between ${first} and ${last}.`,
		stats: [
			{ label: 'Films', value: worked.total ? `${seen} of ${worked.total}` : String(seen) },
			{ label: 'First', value: first },
			{ label: 'Last', value: last }
		],
		body: {
			kind: 'posters',
			posters: posterRow(
				[...worked.films].sort((a, b) => (releaseYear(a) ?? 0) - (releaseYear(b) ?? 0)),
				() => ''
			)
		}
	};
}

export function tagScene({ library }: DeckInput): Scene | null {
	const tag = topTag(library);
	if (!tag || tag.count < MIN_TAG_USES) return null;
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
