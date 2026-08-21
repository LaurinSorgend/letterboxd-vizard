import { combinedVoteCount, type BarDatum } from '$lib/viz/stats';
import type { Wrapped } from '../wrapped';
import { longDate } from '../facts/dates';
import { barsFrom, plural, posterOf, runtimeLabel, stars } from './shared';
import type { Accent, Scene } from './shared';

export function titleScene(data: Wrapped): Scene {
	const who = data.viewer ? `${data.viewer}, ` : '';
	return {
		id: 'title',
		accent: 'neutral',
		label: 'Your year in cinema',
		value: String(data.year),
		valueKind: 'number',
		note: data.partial
			? `${who}${data.year} is still running. Here is the year so far, one frame at a time.`
			: `${who}here is ${data.year}, one frame at a time.`,
		stats: [
			{ label: 'Films', value: String(data.films.length) },
			{ label: 'Hours', value: data.hours.toLocaleString('en') },
			{ label: 'Average', value: stars(data.avg) }
		],
		body: { kind: 'none' }
	};
}

export function countScene(data: Wrapped): Scene {
	return {
		id: 'count',
		accent: 'amber',
		label: 'Films watched',
		value: data.films.length.toLocaleString('en'),
		valueKind: 'number',
		note:
			data.rewatches > 0
				? `${plural(data.watches, 'diary entry', 'diary entries')}, of which ${plural(data.rewatches, 'was', 'were')} a return visit.`
				: `${plural(data.watches, 'diary entry', 'diary entries')}, every one of them a first watch.`,
		stats: [
			{ label: 'Entries', value: String(data.watches) },
			{ label: 'Rewatches', value: String(data.rewatches) },
			{ label: 'Rated', value: String(data.films.filter((film) => film.rating !== null).length) }
		],
		body: { kind: 'none' }
	};
}

export function hoursScene(data: Wrapped): Scene {
	const weeks = data.partial ? Math.max(1, new Date().getMonth() + 1) * 4.35 : 52;
	return {
		id: 'hours',
		accent: 'gold',
		label: 'Hours in the dark',
		value: data.hours.toLocaleString('en'),
		valueKind: 'number',
		note: `${plural(data.days, 'day')} end to end, if you never stopped to sleep.`,
		stats: [
			{ label: 'Per week', value: (data.hours / weeks).toFixed(1) },
			{ label: 'Days', value: String(data.days) }
		],
		body: { kind: 'none' }
	};
}

export function monthScene(data: Wrapped): Scene | null {
	if (!data.busiestMonth) return null;
	const active = data.perMonth.filter((count) => count > 0);
	const quietest = Math.min(...active);
	return {
		id: 'months',
		accent: 'cyan',
		label: 'Your busiest month',
		value: data.busiestMonth.name,
		valueKind: 'name',
		note: `${plural(data.busiestMonth.count, 'entry', 'entries')} in ${data.busiestMonth.name}. Your quietest active month managed ${quietest}.`,
		stats: [{ label: 'Months active', value: String(active.length) }],
		body: {
			kind: 'bars',
			bars: data.perMonth.map((count, month) => ({
				label: new Date(Date.UTC(2000, month, 1)).toLocaleDateString('en', {
					month: 'narrow',
					timeZone: 'UTC'
				}),
				value: String(count),
				share: count / data.busiestMonth!.count
			}))
		}
	};
}

export function streakScene(data: Wrapped): Scene | null {
	if (!data.streak) return null;
	const day = data.busiestDay;
	return {
		id: 'streak',
		accent: 'cyan',
		label: 'Longest streak',
		value: String(data.streak.days),
		valueKind: 'number',
		note: `Consecutive days with something logged, from ${longDate(data.streak.start, data.year)} to ${longDate(data.streak.end, data.year)}.`,
		stats: day
			? [
					{ label: 'Heaviest day', value: String(day.count) },
					{ label: 'On', value: longDate(day.date, data.year) }
				]
			: [],
		body: day
			? { kind: 'posters', posters: day.films.slice(0, 6).map((film) => posterOf(film, '')) }
			: { kind: 'none' }
	};
}

export function topFilmsScene(data: Wrapped): Scene | null {
	if (data.top.length === 0) return null;
	return {
		id: 'top',
		accent: 'oxblood',
		label: 'Your five best',
		value: data.top[0].name,
		valueKind: 'name',
		note: 'Ranked by the stars you gave them, ties broken by the ones you hearted.',
		stats: [{ label: 'Your average', value: stars(data.avg) }],
		body: {
			kind: 'posters',
			posters: data.top.map((film) => posterOf(film, film.rating ? `★ ${film.rating}` : ''))
		}
	};
}

export function genreScene(data: Wrapped): Scene | null {
	const top = data.topGenres[0];
	if (!top) return null;
	return {
		id: 'genre',
		accent: 'forest',
		label: 'Genre of the year',
		value: top.label,
		valueKind: 'name',
		note: `${plural(top.count, 'film')}${top.avg !== null ? `, averaging ${stars(top.avg)}` : ''}. A film counts once per genre it carries.`,
		stats: [],
		body: { kind: 'bars', bars: barsFrom(data.topGenres) }
	};
}

export function personScene(
	id: string,
	accent: Accent,
	label: string,
	note: (datum: BarDatum) => string,
	people: BarDatum[]
): Scene | null {
	const top = people[0];
	if (!top) return null;
	return {
		id,
		accent,
		label,
		value: top.label,
		valueKind: 'name',
		note: note(top),
		stats: people.slice(1).map((person) => ({ label: person.label, value: String(person.count) })),
		body: {
			kind: 'posters',
			posters: top.films
				.slice(0, 6)
				.map((film) => posterOf(film, film.rating ? `★ ${film.rating}` : ''))
		}
	};
}

export function directorScene(data: Wrapped): Scene | null {
	return personScene(
		'director',
		'indigo',
		'Director of the year',
		(person) =>
			`${plural(person.count, 'of their films')} this year${person.avg !== null ? `, averaging ${stars(person.avg)}` : ''}.`,
		data.topDirectors
	);
}

export function actorScene(data: Wrapped): Scene | null {
	return personScene(
		'actor',
		'indigo',
		'On screen most',
		(person) => `Billed in ${plural(person.count, 'of your films')}.`,
		data.topActors
	);
}

export function reachScene(data: Wrapped): Scene | null {
	if (data.countries === 0) return null;
	return {
		id: 'reach',
		accent: 'cyan',
		label: 'How far you travelled',
		value: String(data.countries),
		valueKind: 'number',
		note: `Countries of production, across ${plural(data.languages, 'original language')}.`,
		stats: data.topLanguages.map((language) => ({
			label: language.label,
			value: String(language.count)
		})),
		body: {
			kind: 'bars',
			bars: data.topCountries.map((country) => ({
				label: country.name,
				value: String(country.count),
				share: country.count / (data.topCountries[0]?.count || 1)
			}))
		}
	};
}

export function eraScene(data: Wrapped): Scene | null {
	if (data.medianYear === null || !data.oldest) return null;
	const oldestYear = data.oldest.tmdb?.year ?? data.oldest.year;
	return {
		id: 'era',
		accent: 'gold',
		label: 'Your median release year',
		value: String(data.medianYear),
		valueKind: 'number',
		note: `Half of what you watched came out before ${data.medianYear}. The oldest was ${data.oldest.name}, from ${oldestYear}.`,
		stats: [{ label: 'Years back', value: String(data.year - data.medianYear) }],
		body: { kind: 'posters', posters: [posterOf(data.oldest, String(oldestYear ?? ''))] }
	};
}

export function longestScene(data: Wrapped): Scene | null {
	const runtime = data.longest?.tmdb?.runtime;
	if (!data.longest || !runtime) return null;
	return {
		id: 'longest',
		accent: 'amber',
		label: 'The longest sitting',
		value: runtimeLabel(runtime),
		valueKind: 'number',
		note: `${data.longest.name}${data.longest.tmdb?.year ? ` (${data.longest.tmdb.year})` : ''} ran ${plural(runtime, 'minute')}.`,
		stats: [{ label: 'Minutes', value: String(runtime) }],
		body: { kind: 'posters', posters: [posterOf(data.longest, runtimeLabel(runtime))] }
	};
}

export function gapScene(data: Wrapped): Scene | null {
	if (!data.over) return null;
	const { film, yours, tmdb, gap } = data.over;
	return {
		id: 'gap',
		accent: 'magenta',
		label: 'You against the crowd',
		value: `+${gap.toFixed(1)}`,
		valueKind: 'number',
		note: `You gave ${film.name} ★ ${yours} where the crowd settled on ★ ${tmdb.toFixed(1)}. Nobody else has to agree.`,
		stats: data.under
			? [
					{ label: 'Crowd favourite', value: data.under.film.name },
					{ label: 'You gave it', value: `★ ${data.under.yours}` }
				]
			: [],
		body: { kind: 'posters', posters: [posterOf(film, `★ ${yours}`)] }
	};
}

export function deepCutScene(data: Wrapped): Scene | null {
	if (!data.mostObscure) return null;
	const votes = combinedVoteCount(data.mostObscure);
	return {
		id: 'deep-cut',
		accent: 'magenta',
		label: 'Deepest cut',
		value: data.mostObscure.name,
		valueKind: 'name',
		note: `${votes.toLocaleString('en')} ratings across TMDB and IMDb. You were one of them.`,
		stats: data.mostPopular
			? [
					{ label: 'Biggest crowd', value: data.mostPopular.name },
					{ label: 'Ratings', value: combinedVoteCount(data.mostPopular).toLocaleString('en') }
				]
			: [],
		body: { kind: 'posters', posters: [posterOf(data.mostObscure, votes.toLocaleString('en'))] }
	};
}

export function verdictScene(data: Wrapped): Scene {
	return {
		id: 'verdict',
		accent: 'oxblood',
		label: `Your ${data.year}, in one word`,
		value: data.personality.title,
		valueKind: 'name',
		note: data.personality.detail,
		stats: [],
		footnote:
			data.personality.alsoTrue.length > 0
				? `Also true: ${data.personality.alsoTrue.join(', ')}`
				: undefined,
		body: { kind: 'none' }
	};
}

export function summaryScene(data: Wrapped): Scene {
	return {
		id: 'summary',
		accent: 'neutral',
		label: 'Take it with you',
		value: String(data.year),
		valueKind: 'number',
		note: 'One picture with the whole year on it. Save it, or send it straight on.',
		stats: [],
		body: { kind: 'summary' }
	};
}
