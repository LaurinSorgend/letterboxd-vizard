import { alsoTrueLine } from '$lib/year/verdict';
import { isRunning } from '$lib/year/library';
import { releaseYear } from '$lib/film/release';
import { busiestMonth, perMonth } from '$lib/year/facts/months';
import { busiestDay, streak } from '$lib/year/facts/timing';
import {
	averageRating,
	countries,
	hours,
	languages,
	rewatches,
	topRated
} from '$lib/year/facts/totals';
import {
	longest,
	medianReleaseYear,
	mostObscure,
	mostPopular,
	oldest
} from '$lib/year/facts/extremes';
import { votes } from '$lib/film/votes';
import { crowdGap } from '$lib/year/facts/critics';
import type { BarDatum } from '$lib/film/tally';
import { billedIn, LABELS, ratingsAcross, TOP_FILMS } from '../labels';
import { datePair, longDate, monthInitial, monthName } from './prose';
import { count, plural, runtimeLabel, starCaption, stars } from '$lib/format';
import { barsFrom, posterOf, posterRow } from './shared';
import type { Accent } from '../look';
import type { DeckInput, Scene } from './shared';

export function titleScene({ library, viewer }: DeckInput): Scene {
	const who = viewer ? `${viewer}, ` : '';
	const { year } = library;
	return {
		id: 'title',
		accent: 'neutral',
		label: LABELS.title,
		value: String(year),
		valueKind: 'number',
		note: isRunning(library)
			? `${who}${year} is still running. Here is the year so far, one frame at a time.`
			: `${who}here is ${year}, one frame at a time.`,
		stats: [
			{ label: 'Films', value: String(library.slice.length) },
			{ label: 'Hours', value: count(hours(library)) },
			{ label: 'Average', value: stars(averageRating(library)) }
		],
		backdrop: 'rain',
		body: { kind: 'none' }
	};
}

export function countScene({ library }: DeckInput): Scene {
	const entries = library.dates.length;
	const returns = rewatches(library);
	return {
		id: 'count',
		accent: 'amber',
		label: LABELS.films,
		value: count(library.slice.length),
		valueKind: 'number',
		note:
			returns > 0
				? `${plural(entries, 'diary entry', 'diary entries')}, of which ${plural(returns, 'was', 'were')} a return visit.`
				: `${plural(entries, 'diary entry', 'diary entries')}, every one of them a first watch.`,
		stats: [
			{ label: 'Entries', value: count(entries) },
			{ label: 'Rewatches', value: count(returns) },
			{
				label: 'Rated',
				value: count(library.slice.filter((film) => film.rating !== null).length)
			}
		],
		body: { kind: 'none' }
	};
}

export function hoursScene({ library }: DeckInput): Scene | null {
	const total = hours(library);
	// Runtimes come from TMDB, so a library that never matched has nothing to total and the
	// frame disappears rather than headlining a zero.
	if (total === 0) return null;
	const days = Math.round(total / 24);
	const weeks = isRunning(library) ? (library.now.getMonth() + 1) * 4.35 : 52;
	return {
		id: 'hours',
		accent: 'gold',
		label: 'Hours in the dark',
		value: count(total),
		valueKind: 'number',
		note: `${days > 0 ? plural(days, 'day') : plural(total, 'hour')} end to end, if you never stopped to sleep.`,
		stats: [
			{ label: 'Per week', value: (total / weeks).toFixed(1) },
			{ label: 'Days', value: String(days) }
		],
		body: { kind: 'none' }
	};
}

export function monthScene({ library }: DeckInput): Scene | null {
	const peak = busiestMonth(library);
	if (!peak) return null;
	const months = perMonth(library);
	const active = months.filter((count) => count > 0);
	const name = monthName(peak.month);
	return {
		id: 'months',
		accent: 'cyan',
		label: 'Your busiest month',
		value: name,
		valueKind: 'name',
		note: `${plural(peak.count, 'entry', 'entries')} in ${name}. Your quietest active month managed ${Math.min(...active)}.`,
		stats: [{ label: 'Months active', value: String(active.length) }],
		body: {
			kind: 'bars',
			bars: months.map((count, month) => ({
				label: monthInitial(month),
				value: String(count),
				share: count / peak.count
			}))
		}
	};
}

export function streakScene({ library }: DeckInput): Scene | null {
	const run = streak(library);
	if (!run) return null;
	const day = busiestDay(library);
	const [from, to] = datePair(run.start, run.end, library.year);
	return {
		id: 'streak',
		accent: 'cyan',
		label: LABELS.streak,
		value: String(run.days),
		valueKind: 'number',
		note: `Consecutive days with something logged, from ${from} to ${to}.`,
		stats: day
			? [
					{ label: 'Heaviest day', value: String(day.count) },
					{ label: 'On', value: longDate(day.date, library.year) }
				]
			: [],
		body: day ? { kind: 'posters', posters: posterRow(day.films, () => '') } : { kind: 'none' }
	};
}

export function topFilmsScene({ library }: DeckInput): Scene | null {
	const top = topRated(library).slice(0, TOP_FILMS);
	if (top.length === 0) return null;
	return {
		id: 'top',
		accent: 'oxblood',
		label: LABELS.top,
		value: top[0].name,
		valueKind: 'name',
		note: '',
		stats: [{ label: 'Your average', value: stars(averageRating(library)) }],
		body: {
			kind: 'posters',
			posters: posterRow(top, (film) => starCaption(film.rating))
		}
	};
}

export function genreScene({ library }: DeckInput): Scene | null {
	const genres = library.genres().slice(0, 5);
	const top = genres[0];
	if (!top) return null;
	return {
		id: 'genre',
		accent: 'forest',
		label: LABELS.genre,
		value: top.label,
		valueKind: 'name',
		note: `${plural(top.count, 'film')}${top.avg !== null ? `, averaging ${stars(top.avg)}` : ''}.`,
		stats: [],
		body: { kind: 'bars', bars: barsFrom(genres) }
	};
}

function personScene(
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
			posters: posterRow(top.films, (film) => starCaption(film.rating))
		}
	};
}

export function directorScene({ library }: DeckInput): Scene | null {
	return personScene(
		'director',
		'indigo',
		LABELS.director,
		(person) =>
			`${count(person.count)} of their films this year${person.avg !== null ? `, averaging ${stars(person.avg)}` : ''}.`,
		library.directors().slice(0, 3)
	);
}

export function actorScene({ library }: DeckInput): Scene | null {
	return personScene(
		'actor',
		'indigo',
		LABELS.actor,
		(person) => billedIn(person.count),
		library.cast().slice(0, 3)
	);
}

export function reachScene({ library }: DeckInput): Scene | null {
	const places = countries(library);
	if (places.length === 0) return null;
	const spoken = languages(library);
	const top = places.slice(0, 3);
	return {
		id: 'reach',
		accent: 'cyan',
		label: 'How far you travelled',
		value: String(places.length),
		valueKind: 'number',
		note: `Countries of production, across ${plural(spoken.length, 'original language')}.`,
		stats: spoken.slice(0, 3).map((language) => ({
			label: language.label,
			value: String(language.count)
		})),
		body: {
			kind: 'bars',
			bars: top.map((country) => ({
				label: country.name,
				value: String(country.count),
				share: country.count / top[0].count
			}))
		}
	};
}

export function eraScene({ library }: DeckInput): Scene | null {
	const median = medianReleaseYear(library);
	const first = oldest(library);
	if (median === null || !first) return null;
	const oldestYear = releaseYear(first);
	return {
		id: 'era',
		accent: 'gold',
		label: 'Your median release year',
		value: String(median),
		valueKind: 'number',
		note: `Half of what you watched came out before ${median}. The oldest was ${first.name}, from ${oldestYear}.`,
		stats: [{ label: 'Years back', value: String(library.year - median) }],
		body: { kind: 'posters', posters: [posterOf(first, String(oldestYear ?? ''))] }
	};
}

export function longestScene({ library }: DeckInput): Scene | null {
	const film = longest(library);
	const runtime = film?.tmdb?.runtime;
	if (!film || !runtime) return null;
	const year = releaseYear(film);
	return {
		id: 'longest',
		accent: 'amber',
		label: 'The longest sitting',
		value: runtimeLabel(runtime),
		valueKind: 'number',
		note: `${film.name}${year ? ` (${year})` : ''} ran ${plural(runtime, 'minute')}.`,
		stats: [{ label: 'Minutes', value: String(runtime) }],
		body: { kind: 'posters', posters: [posterOf(film, runtimeLabel(runtime))] }
	};
}

export function gapScene({ library }: DeckInput): Scene | null {
	const { over, under } = crowdGap(library);
	if (!over) return null;
	const { film, yours, source: tmdb, gap } = over;
	return {
		id: 'gap',
		accent: 'magenta',
		label: LABELS.crowd,
		value: `+${gap.toFixed(1)}`,
		valueKind: 'number',
		note: `You gave ${film.name} ${starCaption(yours)} where the crowd settled on ${stars(tmdb)}. Nobody else has to agree.`,
		stats: under
			? [
					{ label: 'Crowd favourite', value: under.film.name },
					{ label: 'You gave it', value: starCaption(under.yours) }
				]
			: [],
		body: { kind: 'posters', posters: [posterOf(film, starCaption(yours))] }
	};
}

export function deepCutScene({ library }: DeckInput): Scene | null {
	const deepest = mostObscure(library);
	if (!deepest) return null;
	const popular = mostPopular(library);
	return {
		id: 'deep-cut',
		accent: 'magenta',
		label: LABELS.deepCut,
		value: deepest.name,
		valueKind: 'name',
		note: `${ratingsAcross(votes(deepest))}. You were one of them.`,
		stats: popular
			? [
					{ label: LABELS.biggestCrowd, value: popular.name },
					{ label: 'Ratings', value: count(votes(popular)) }
				]
			: [],
		body: { kind: 'posters', posters: [posterOf(deepest, count(votes(deepest)))] }
	};
}

export function verdictScene({ personality }: DeckInput): Scene {
	return {
		id: 'verdict',
		accent: 'oxblood',
		label: LABELS.verdict,
		value: personality.title,
		valueKind: 'name',
		note: personality.detail,
		stats: [],
		footnote: alsoTrueLine(personality) ?? undefined,
		body: { kind: 'none' }
	};
}

export function summaryScene({ library }: DeckInput): Scene {
	return {
		id: 'summary',
		accent: 'neutral',
		label: 'Take it with you',
		value: String(library.year),
		valueKind: 'number',
		note: 'One picture with the whole year on it. Save it, or send it straight on.',
		stats: [],
		body: { kind: 'summary' }
	};
}
