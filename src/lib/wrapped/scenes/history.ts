import {
	filmsPerYear,
	firstTimeDirectors,
	fiveStars,
	mostLogged,
	ratingDrift
} from '../facts/history';
import { monthName, monthOf } from '../facts/dates';
import { plural, posterOf, stars, type Scene } from './shared';
import type { Wrapped } from '../wrapped';

const MIN_YEARS = 2;

export function perYearScene(data: Wrapped): Scene | null {
	const years = filmsPerYear(data.library);
	if (years.length < MIN_YEARS) return null;
	const current = years.find((entry) => entry.year === data.year);
	if (!current) return null;
	const previous = years.find((entry) => entry.year === data.year - 1);
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
		note: `${plural(current.count, 'film')} in ${data.year}, against ${previous?.count ?? 0} in ${data.year - 1}. Your busiest year was ${best.year}, with ${best.count}.`,
		stats: [
			{ label: String(data.year - 1), value: String(previous?.count ?? 0) },
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

export function mostLoggedScene(data: Wrapped): Scene | null {
	const most = mostLogged(data.library);
	if (!most) return null;
	const first = most.first;
	const extra =
		most.runnerUp > 0
			? ` No other film in your diary has been logged more than ${plural(most.runnerUp, 'time')}.`
			: '';
	return {
		id: 'most-logged',
		accent: 'oxblood',
		label: 'The one you keep going back to',
		value: most.film.name,
		valueKind: 'name',
		// "of them" already reads correctly at any count, so the many-form is kept identical to
		// the one-form rather than letting the default rule tack an "s" onto "them".
		note: `${plural(most.total, 'time')} since ${monthName(monthOf(first))} ${first.slice(0, 4)}, ${plural(most.thisYear, 'of them', 'of them')} this year.${extra}`,
		stats: [
			{ label: 'Total logs', value: String(most.total) },
			{ label: 'First', value: `${monthName(monthOf(first))} ${first.slice(0, 4)}` },
			{ label: 'This year', value: String(most.thisYear) }
		],
		body: { kind: 'posters', posters: [posterOf(most.film, `${most.total}×`)] }
	};
}

export function fiveStarScene(data: Wrapped): Scene | null {
	const top = fiveStars(data.library);
	// A count of zero would still clear the MIN_RATED gate below, but the frame exists to show off
	// five-star films: with none to show, it drops out rather than headlining a zero.
	if (!top || top.count === 0) return null;
	return {
		id: 'five-stars',
		accent: 'gold',
		label: 'Five stars',
		value: String(top.count),
		valueKind: 'number',
		// `top.rated` is the same population `top.share` is a fraction of, so the two always agree —
		// a locally recomputed count (e.g. films with a non-null current rating) can diverge from it.
		note: `${plural(top.count, 'five-star rating')} out of ${plural(top.rated, 'rated film')}.${top.lastYear === null ? '' : ` Last year you gave ${plural(top.lastYear, 'five-star rating')}.`}`,
		stats: [
			{ label: 'Share', value: `${Math.round(top.share * 100)}%` },
			{ label: 'Most-used rating', value: stars(top.modal) },
			...(top.lastYear === null
				? []
				: [{ label: `In ${data.year - 1}`, value: String(top.lastYear) }])
		],
		body: {
			kind: 'posters',
			posters: top.films.map((film) => posterOf(film, '★ 5'))
		}
	};
}

export function firstTimersScene(data: Wrapped): Scene | null {
	const fresh = firstTimeDirectors(data.library);
	if (!fresh) return null;
	// "of theirs" already reads correctly at any count, so the many-form is kept identical to the
	// one-form rather than letting the default rule tack an "s" onto "theirs".
	return {
		id: 'first-timers',
		accent: 'indigo',
		label: 'New to you',
		value: String(fresh.directors),
		valueKind: 'number',
		note: `${plural(fresh.directors, 'director')} you had never logged before. ${fresh.top!.name} arrived this year and you watched ${plural(fresh.top!.count, 'of theirs', 'of theirs')}.`,
		stats: [
			{ label: 'Most watched', value: `${fresh.top!.name}, ${fresh.top!.count}` },
			{ label: 'Their films', value: String(fresh.byFirstTimers) }
		],
		body: {
			kind: 'posters',
			posters: fresh.films.map((film) => posterOf(film, film.rating ? `★ ${film.rating}` : ''))
		}
	};
}

export function driftScene(data: Wrapped): Scene | null {
	const drift = ratingDrift(data.library);
	if (!drift) return null;
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
