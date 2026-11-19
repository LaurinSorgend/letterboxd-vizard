import {
	filmsPerYear,
	firstTimeDirectors,
	fiveStars,
	mostLogged,
	ratingDrift
} from '$lib/year/facts/history';
import { monthOf } from '$lib/year/calendar';
import { monthName } from './prose';
import { byRating } from '$lib/year/facts/totals';
import { count, percent, plural, starCaption, stars } from '$lib/format';
import { posterOf, posterRow, type DeckInput, type Scene } from './shared';

const MIN_YEARS = 2;
/** A film logged twice is a rewatch; three times is a habit. */
const MIN_LOGS = 3;
const MIN_RATED = 20;
/** Half a star is noise between two moods; a whole star is a changed mind. */
const MIN_DRIFT = 1;

export function perYearScene({ library }: DeckInput): Scene | null {
	const years = filmsPerYear(library);
	if (years.length < MIN_YEARS) return null;
	const current = years.find((entry) => entry.year === library.year);
	if (!current) return null;
	const previous = years.find((entry) => entry.year === library.year - 1);
	const best = years.reduce((most, entry) => (entry.count > most.count ? entry : most));
	const change =
		previous && previous.count > 0
			? `${current.count >= previous.count ? '+' : ''}${Math.round(
					((current.count - previous.count) / previous.count) * 100
				)}%`
			: '—';
	return {
		id: 'per-year',
		accent: 'amber',
		label: 'Films per year',
		value: String(current.count),
		valueKind: 'number',
		note: `${plural(current.count, 'film')} in ${library.year}${
			previous && previous.count > 0
				? `, against ${previous.count} in ${library.year - 1}`
				: `. Nothing logged in ${library.year - 1}`
		}. Your busiest year was ${best.year}, with ${best.count}.`,
		stats: [
			{ label: String(library.year - 1), value: String(previous?.count ?? 0) },
			{ label: 'Change', value: change },
			{ label: 'Best year', value: String(best.year) }
		],
		body: {
			kind: 'bars',
			bars: years.map((entry) => ({
				label: String(entry.year).slice(2),
				value: String(entry.count),
				share: entry.count / best.count
			}))
		}
	};
}

export function mostLoggedScene({ library }: DeckInput): Scene | null {
	const most = mostLogged(library);
	if (!most || most.total < MIN_LOGS || most.thisYear === 0) return null;
	const first = most.first;
	const extra =
		most.runnerUp >= MIN_LOGS
			? ` No other film in your diary has been logged more than ${plural(most.runnerUp, 'time')}.`
			: '';
	return {
		id: 'most-logged',
		accent: 'oxblood',
		label: 'The one you keep going back to',
		value: most.film.name,
		valueKind: 'name',
		note: `${plural(most.total, 'time')} since ${monthName(monthOf(first))} ${first.slice(0, 4)}, ${count(most.thisYear)} of them this year.${extra}`,
		stats: [
			{ label: 'Total logs', value: String(most.total) },
			{ label: 'First', value: `${monthName(monthOf(first))} ${first.slice(0, 4)}` },
			{ label: 'This year', value: String(most.thisYear) }
		],
		body: { kind: 'posters', posters: [posterOf(most.film, `${most.total}×`)] }
	};
}

export function fiveStarScene({ library }: DeckInput): Scene | null {
	const top = fiveStars(library);
	// The frame shows off five-star films: with none to show it drops out rather than headline a zero.
	if (!top || top.rated < MIN_RATED || top.count === 0) return null;
	const lastYear =
		top.lastYear === null
			? ''
			: top.lastYear === 0
				? ' Last year you gave none.'
				: ` Last year you gave ${plural(top.lastYear, 'five-star rating')}.`;
	return {
		id: 'five-stars',
		accent: 'gold',
		label: 'Five stars',
		value: String(top.count),
		valueKind: 'number',
		note: `${plural(top.count, 'five-star rating')} out of ${plural(top.rated, 'rated film')}.${lastYear}`,
		stats: [
			{ label: 'Share', value: percent(top.share) },
			{ label: 'Most-used rating', value: stars(top.modal) },
			...(top.lastYear === null
				? []
				: [{ label: `In ${library.year - 1}`, value: String(top.lastYear) }])
		],
		body: {
			kind: 'posters',
			posters: posterRow(top.films, () => starCaption(5))
		}
	};
}

export function firstTimersScene({ library }: DeckInput): Scene | null {
	const fresh = firstTimeDirectors(library);
	if (!fresh) return null;
	return {
		id: 'first-timers',
		accent: 'indigo',
		label: 'New to you',
		value: String(fresh.directors),
		valueKind: 'number',
		note: `${plural(fresh.directors, 'director')} you had never logged before. ${fresh.top.name} arrived this year and you watched ${count(fresh.top.count)} of theirs.`,
		stats: [
			{ label: 'Most watched', value: `${fresh.top.name}, ${fresh.top.count}` },
			{ label: 'Their films', value: String(fresh.films.length) }
		],
		body: {
			kind: 'posters',
			posters: posterRow([...fresh.films].sort(byRating), (film) => starCaption(film.rating))
		}
	};
}

export function driftScene({ library }: DeckInput): Scene | null {
	const drift = ratingDrift(library);
	if (!drift || Math.abs(drift.delta) < MIN_DRIFT) return null;
	const up = drift.delta > 0;
	return {
		id: 'drift',
		accent: 'magenta',
		label: up ? 'It grew on you' : 'It did not hold up',
		value: drift.film.name,
		valueKind: 'name',
		note: `You gave it ${stars(drift.before.rating)} in ${drift.before.date.slice(0, 4)} and ${stars(drift.after.rating)} this time. ${plural(drift.rethought, 'film')} in your diary changed your mind this year.`,
		stats: [
			{ label: 'Then', value: stars(drift.before.rating) },
			{ label: 'Now', value: stars(drift.after.rating) },
			{ label: 'Moved by', value: `${up ? '+' : ''}${drift.delta.toFixed(1)}` }
		],
		body: { kind: 'posters', posters: [posterOf(drift.film, stars(drift.after.rating))] }
	};
}
