import { byPerson, type BarDatum } from './stats';
import type { EnrichedFilm } from '$lib/types';

export type PersonRole = 'director' | 'actor';

/** Up to this many people can be plotted at once; matches the size of the timeline's color palette. */
export const MAX_SELECTED = 8;

export interface PersonOption {
	key: string;
	name: string;
	role: PersonRole;
	count: number;
	image?: string | null;
	imageLarge?: string | null;
	href?: string;
	films: EnrichedFilm[];
}

function toOption(datum: BarDatum, role: PersonRole): PersonOption {
	return {
		key: `${role}:${datum.label}`,
		name: datum.label,
		role,
		count: datum.count,
		image: datum.image,
		imageLarge: datum.imageLarge,
		href: datum.href,
		films: datum.films
	};
}

/**
 * Every director, then every actor, in your library, most-watched first within each. Keyed by
 * role and name rather than TMDB id, the same label-based identity `RankedBars`/`selectByLabel`
 * already use elsewhere, so two different people sharing a name is a pre-existing, accepted edge
 * case rather than a new one.
 */
export function personOptions(films: EnrichedFilm[]): PersonOption[] {
	return [
		...byPerson(films, 'directors').map((d) => toOption(d, 'director')),
		...byPerson(films, 'cast').map((d) => toOption(d, 'actor'))
	];
}

/** Your top 2 directors and top 2 actors, fewer if the library doesn't have that many. */
export function defaultSelectionKeys(films: EnrichedFilm[]): string[] {
	return [
		...byPerson(films, 'directors')
			.slice(0, 2)
			.map((d) => `director:${d.label}`),
		...byPerson(films, 'cast')
			.slice(0, 2)
			.map((d) => `actor:${d.label}`)
	];
}

export interface WatchEvent {
	date: string;
	hours: number;
	film: EnrichedFilm;
}

export interface SeriesPoint {
	date: string;
	cumulativeHours: number;
	event: WatchEvent;
}

export interface PersonSeries {
	option: PersonOption;
	/** Oldest first; cumulative, so the last point is always the running total. */
	points: SeriesPoint[];
	/** Diary entries left out for want of a known runtime. */
	excluded: number;
}

/**
 * Every diary date across a person's films as its own event — a film rewatched three times
 * contributes three events, at three dates, the same convention `diaryEvents` in `milestones.ts`
 * uses — turned into a running total of hours watched.
 */
export function buildSeries(option: PersonOption): PersonSeries {
	const events: WatchEvent[] = [];
	let excluded = 0;
	for (const film of option.films) {
		const runtime = film.tmdb?.runtime;
		for (const date of film.watchedDates) {
			if (!runtime) {
				excluded++;
				continue;
			}
			events.push({ date, hours: runtime / 60, film });
		}
	}
	events.sort((a, b) => a.date.localeCompare(b.date));

	let total = 0;
	const points = events.map((event) => {
		total += event.hours;
		return { date: event.date, cumulativeHours: total, event };
	});

	return { option, points, excluded };
}
