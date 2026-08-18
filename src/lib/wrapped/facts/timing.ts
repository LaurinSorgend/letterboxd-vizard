import { datesIn, type Library } from '../library';
import { dayNumber, daysBetween, weekdayOf } from './dates';
import type { EnrichedFilm } from '$lib/types';

export interface Gap {
	days: number;
	from: string;
	to: string;
	/** Where the silence sat: inside the year, before the first entry, or after the last. */
	kind: 'between' | 'late-start' | 'early-stop';
	second: number;
}

/** The last day the year can be judged against: 31 December, or today for a running year. */
function closingDate(library: Library): string {
	const end = `${library.year}-12-31`;
	const today = library.now.toISOString().slice(0, 10);
	return today < end ? today : end;
}

export function longestGap(library: Library): Gap | null {
	const days = [...new Set(library.dates)].sort();
	if (days.length === 0) return null;

	const candidates: Gap[] = [
		{
			days: daysBetween(`${library.year}-01-01`, days[0]),
			from: `${library.year}-01-01`,
			to: days[0],
			kind: 'late-start',
			second: 0
		},
		{
			days: daysBetween(days[days.length - 1], closingDate(library)),
			from: days[days.length - 1],
			to: closingDate(library),
			kind: 'early-stop',
			second: 0
		}
	];
	for (let i = 1; i < days.length; i++) {
		candidates.push({
			days: daysBetween(days[i - 1], days[i]),
			from: days[i - 1],
			to: days[i],
			kind: 'between',
			second: 0
		});
	}

	candidates.sort((a, b) => b.days - a.days);
	return { ...candidates[0], second: candidates[1]?.days ?? 0 };
}

export interface Weekdays {
	/** Seven counts, Monday first. */
	counts: number[];
	best: number;
	worst: number;
	weekendShare: number;
}

export function weekdays(library: Library): Weekdays | null {
	if (library.dates.length === 0) return null;
	const counts = Array.from({ length: 7 }, () => 0);
	for (const date of library.dates) counts[weekdayOf(date)] += 1;
	const best = counts.indexOf(Math.max(...counts));
	const active = counts.map((count, day) => ({ count, day })).filter((entry) => entry.count > 0);
	const worst = active.reduce((low, entry) => (entry.count < low.count ? entry : low)).day;
	return {
		counts,
		best,
		worst,
		weekendShare: (counts[5] + counts[6]) / library.dates.length
	};
}

export interface DoubleBills {
	days: number;
	triples: number;
	/** Share of the year's entries that landed on a day carrying two or more. */
	share: number;
	heaviest: { date: string; count: number } | null;
}

function perDate(library: Library): Map<string, number> {
	const counts = new Map<string, number>();
	for (const date of library.dates) counts.set(date, (counts.get(date) ?? 0) + 1);
	return counts;
}

export function doubleBills(library: Library): DoubleBills | null {
	if (library.dates.length === 0) return null;
	const counts = [...perDate(library)];
	const multiple = counts.filter(([, count]) => count >= 2);
	const triples = counts.filter(([, count]) => count >= 3);
	const heaviest = triples.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
	return {
		days: multiple.length,
		triples: triples.length,
		share: multiple.reduce((sum, [, count]) => sum + count, 0) / library.dates.length,
		heaviest: heaviest ? { date: heaviest[0], count: heaviest[1] } : null
	};
}

export interface BestWeek {
	count: number;
	start: string;
	/** Inclusive, six days after `start`. */
	end: string;
	films: EnrichedFilm[];
	/** The heaviest week that does not overlap the winner, so the comparison means something. */
	runnerUp: number;
}

function isoOf(day: number): string {
	return new Date(day * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function bestWeek(library: Library): BestWeek | null {
	if (library.dates.length === 0) return null;
	const days = library.dates.map(dayNumber).sort((a, b) => a - b);
	const windows = [...new Set(days)].map((start) => ({
		start,
		count: days.filter((day) => day >= start && day < start + 7).length
	}));
	windows.sort((a, b) => b.count - a.count || a.start - b.start);

	const winner = windows[0];
	const runnerUp = windows.find((entry) => Math.abs(entry.start - winner.start) >= 7);
	const start = isoOf(winner.start);
	const end = isoOf(winner.start + 6);
	return {
		count: winner.count,
		start,
		end,
		films: library.slice.filter((film) =>
			datesIn(film, library.year).some((date) => date >= start && date <= end)
		),
		runnerUp: runnerUp?.count ?? 0
	};
}
