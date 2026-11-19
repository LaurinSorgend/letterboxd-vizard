import {
	freshness,
	LONG_WAIT_YEARS,
	longestWait,
	MILLENNIUM,
	MONTH_DAYS,
	quickestWatch
} from '$lib/year/facts/release';
import { fullDate, longDate } from './prose';
import { byRating } from '$lib/year/facts/totals';
import { numberWord, percent, plural, starCaption } from '$lib/format';
import { posterOf, posterRow, type DeckInput, type Scene } from './shared';

/** Twenty films with a release year is the floor at which a share is worth quoting. */
const MIN_DATED = 20;
const MIN_NEW = 3;
/** One very old film among a handful is not a wait worth reporting. */
const MIN_WAIT_DATED = 10;
const MIN_WAIT_YEARS = 5;

export function longestWaitScene({ library }: DeckInput): Scene | null {
	const wait = longestWait(library);
	if (!wait || wait.dated < MIN_WAIT_DATED || wait.years < MIN_WAIT_YEARS) return null;
	const released = wait.released.slice(0, 4);
	const extra =
		wait.longWaits > 1
			? ` ${plural(wait.longWaits - 1, 'other film')} waited ${numberWord(LONG_WAIT_YEARS)} years or more for you.`
			: '';
	return {
		id: 'wait',
		accent: 'oxblood',
		label: 'The longest wait',
		value: String(wait.years),
		valueKind: 'number',
		note: `${wait.film.name} came out in ${released}. You watched it on ${fullDate(wait.watched)}, ${plural(wait.years, 'year')} later.${extra}`,
		stats: [
			{ label: 'Released', value: released },
			{ label: 'Watched', value: fullDate(wait.watched) },
			{ label: `Waited ${LONG_WAIT_YEARS}+ years`, value: String(wait.longWaits) }
		],
		body: { kind: 'posters', posters: [posterOf(wait.film, released)] }
	};
}

export function freshnessScene({ library }: DeckInput): Scene | null {
	const fresh = freshness(library);
	if (fresh.dated < MIN_DATED || fresh.thisYear < MIN_NEW) return null;
	return {
		id: 'new-releases',
		accent: 'cyan',
		label: 'What was new',
		value: percent(fresh.share),
		valueKind: 'number',
		note: `${fresh.thisYear} of your ${library.slice.length} films came out in ${library.year}. The rest of the year you spent in the archive.`,
		stats: [
			{ label: `Released ${library.year}`, value: String(fresh.thisYear) },
			{ label: `Released ${library.year - 1}`, value: String(fresh.lastYear) },
			{ label: `Older than ${MILLENNIUM}`, value: String(fresh.preMillennium) }
		],
		body: {
			kind: 'posters',
			posters: posterRow([...fresh.films].sort(byRating), (film) => starCaption(film.rating))
		}
	};
}

export function shelfScene({ library }: DeckInput): Scene | null {
	const quick = quickestWatch(library);
	if (!quick || quick.days > MONTH_DAYS) return null;
	const extra =
		quick.insideMonth > 1
			? ` Only ${plural(quick.insideMonth - 1, 'other release')} reached you inside a month.`
			: '';
	return {
		id: 'shelf',
		accent: 'forest',
		label: 'Straight off the shelf',
		value: String(quick.days),
		valueKind: 'number',
		note: `You watched ${quick.film.name} ${quick.days === 0 ? 'on the day it opened' : `${plural(quick.days, 'day')} after it opened`}.${extra}`,
		stats: [
			{ label: 'Released', value: longDate(quick.released, library.year) },
			{ label: `Inside ${MONTH_DAYS} days`, value: String(quick.insideMonth) }
		],
		body: { kind: 'posters', posters: [posterOf(quick.film, `${quick.days}d`)] }
	};
}
