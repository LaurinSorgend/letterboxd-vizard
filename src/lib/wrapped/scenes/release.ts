import { freshness, longestWait, quickestWatch } from '../facts/release';
import { longDate } from '../facts/dates';
import { plural, posterOf, type Scene } from './shared';
import type { Wrapped } from '../wrapped';

export function longestWaitScene(data: Wrapped): Scene | null {
	const wait = longestWait(data.library);
	if (!wait) return null;
	const released = wait.released.slice(0, 4);
	const extra =
		wait.overTwenty > 1
			? ` ${plural(wait.overTwenty - 1, 'other film')} waited more than twenty years for you.`
			: '';
	return {
		id: 'wait',
		accent: 'oxblood',
		label: 'The longest wait',
		value: String(wait.years),
		valueKind: 'number',
		note: `${wait.film.name} came out in ${released}. You watched it on ${longDate(wait.watched, data.year)}, ${plural(wait.years, 'year')} later.${extra}`,
		stats: [
			{ label: 'Released', value: released },
			{ label: 'Watched', value: longDate(wait.watched, data.year) },
			{ label: 'Waited 20+ years', value: String(wait.overTwenty) }
		],
		body: { kind: 'posters', posters: [posterOf(wait.film, released)] }
	};
}

export function freshnessScene(data: Wrapped): Scene | null {
	const fresh = freshness(data.library);
	if (!fresh) return null;
	return {
		id: 'new-releases',
		accent: 'cyan',
		label: 'What was new',
		value: `${Math.round(fresh.share * 100)}%`,
		valueKind: 'number',
		note: `${fresh.thisYear} of your ${data.films.length} films came out in ${data.year}. The rest of the year you spent in the archive.`,
		stats: [
			{ label: `Released ${data.year}`, value: String(fresh.thisYear) },
			{ label: `Released ${data.year - 1}`, value: String(fresh.lastYear) },
			{ label: 'Older than 2000', value: String(fresh.preMillennium) }
		],
		body: {
			kind: 'posters',
			posters: fresh.shownFilms.map((film) => posterOf(film, film.rating ? `★ ${film.rating}` : ''))
		}
	};
}

export function shelfScene(data: Wrapped): Scene | null {
	const quick = quickestWatch(data.library);
	if (!quick) return null;
	const extra =
		quick.insideThirty > 1
			? ` Only ${plural(quick.insideThirty - 1, 'other release')} reached you inside a month.`
			: '';
	return {
		id: 'shelf',
		accent: 'forest',
		label: 'Straight off the shelf',
		value: String(quick.days),
		valueKind: 'number',
		note: `You watched ${quick.film.name} ${quick.days === 0 ? 'on the day it opened' : `${plural(quick.days, 'day')} after it opened`}.${extra}`,
		stats: [
			{ label: 'Released', value: longDate(quick.released, data.year) },
			{ label: 'Inside 30 days', value: String(quick.insideThirty) }
		],
		body: { kind: 'posters', posters: [posterOf(quick.film, `${quick.days}d`)] }
	};
}
