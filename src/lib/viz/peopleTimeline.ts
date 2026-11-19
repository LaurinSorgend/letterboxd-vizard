import { byPerson } from '$lib/film/tally';
import { periodMinutes } from '$lib/film/runtime';
import type { EnrichedFilm } from '$lib/types';

type PersonRole = 'director' | 'actor';

export interface PersonOption {
	key: string;
	name: string;
	role: PersonRole;
	count: number;
	href?: string | null;
	films: EnrichedFilm[];
}

function optionsFor(films: EnrichedFilm[], role: PersonRole): PersonOption[] {
	return byPerson(films, role === 'director' ? 'directors' : 'cast').map((datum) => ({
		key: `${role}:${datum.key}`,
		name: datum.label,
		role,
		count: datum.count,
		href: datum.href,
		films: datum.films
	}));
}

/**
 * Every director, then every actor, in your library, most-watched first within each. Keyed by
 * role and `personKey`, so namesakes stay two options.
 */
export function personOptions(films: EnrichedFilm[]): PersonOption[] {
	return [...optionsFor(films, 'director'), ...optionsFor(films, 'actor')];
}

/** Your top 2 directors and top 2 actors. */
export function defaultSelectionKeys(options: PersonOption[]): string[] {
	const top = (role: PersonRole) =>
		options
			.filter((o) => o.role === role)
			.slice(0, 2)
			.map((o) => o.key);
	return [...top('director'), ...top('actor')];
}

interface WatchEvent {
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
	/** Diary entries left out for want of a per-watch runtime: unknown, or a series. */
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
		const minutes = periodMinutes(film);
		for (const date of film.watchedDates) {
			if (!minutes) {
				excluded++;
				continue;
			}
			events.push({ date, hours: minutes / 60, film });
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
