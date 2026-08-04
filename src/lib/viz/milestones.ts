import { longestRun } from './stats';
import type { EnrichedFilm } from '$lib/types';

export interface DiaryEvent {
	film: EnrichedFilm;
	date: string;
}

export interface Milestone {
	date: string;
	eyebrow: string;
	film: EnrichedFilm;
	detail: string;
}

/** Every diary entry across every film, oldest first; ties break on name for stable order. */
export function diaryEvents(films: EnrichedFilm[]): DiaryEvent[] {
	return films
		.flatMap((film) => film.watchedDates.map((date) => ({ film, date })))
		.sort((a, b) => a.date.localeCompare(b.date) || a.film.name.localeCompare(b.film.name));
}

/*
 * Round numbers worth pausing on. 1 doubles as "your first-ever logged watch"; the list is
 * filtered down to whatever a library actually reaches, so a small library gets a short timeline.
 */
const COUNT_MILESTONES = [
	1, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600,
	1800, 2000, 2500, 3000, 3500, 4000, 4500, 5000
];

function ordinal(n: number): string {
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
	switch (n % 10) {
		case 1:
			return `${n}st`;
		case 2:
			return `${n}nd`;
		case 3:
			return `${n}rd`;
		default:
			return `${n}th`;
	}
}

function countMilestones(events: DiaryEvent[]): Milestone[] {
	const total = events.length;
	return COUNT_MILESTONES.filter((n) => n <= total).map((n) => {
		const event = events[n - 1];
		return {
			date: event.date,
			eyebrow: n === 1 ? 'First watch' : `${ordinal(n)} watch`,
			film: event.film,
			detail: describeFilm(event.film)
		};
	});
}

/**
 * The first time any single film reaches its Nth logged watch, i.e. the earliest point in your
 * history a film became a 2x, 3x, ... rewatch. Pre-diary rewatches are invisible here, same
 * undercount as `mostRewatched` in stats.ts.
 */
function firstToReachRewatches(events: DiaryEvent[], n: number): Milestone | null {
	const counts = new Map<string, number>();
	for (const event of events) {
		const count = (counts.get(event.film.uri) ?? 0) + 1;
		counts.set(event.film.uri, count);
		if (count === n) {
			const eyebrow = n === 2 ? 'First rewatch' : `First film watched ${n}x`;
			return { date: event.date, eyebrow, film: event.film, detail: describeFilm(event.film) };
		}
	}
	return null;
}

function firstEventWhere(
	events: DiaryEvent[],
	eyebrow: string,
	predicate: (film: EnrichedFilm) => boolean
): Milestone | null {
	const event = events.find((e) => predicate(e.film));
	return event ? { date: event.date, eyebrow, film: event.film, detail: describeFilm(event.film) } : null;
}

function describeFilm(film: EnrichedFilm): string {
	const parts = [film.year ? String(film.year) : null, film.rating !== null ? `★ ${film.rating}` : null];
	return parts.filter((p): p is string => p !== null).join(' · ');
}

/** Every milestone reached in this library, oldest first. Empty if nothing has a diary date. */
export function buildMilestones(films: EnrichedFilm[]): Milestone[] {
	const events = diaryEvents(films);
	if (events.length === 0) return [];

	const milestones: Milestone[] = [
		...countMilestones(events),
		...[2, 3, 5, 10]
			.map((n) => firstToReachRewatches(events, n))
			.filter((m): m is Milestone => m !== null),
		firstEventWhere(events, 'First 5★', (film) => film.rating === 5),
		firstEventWhere(events, 'First film hearted', (film) => film.liked)
	].filter((m): m is Milestone => m !== null);

	const streak = longestRun(events.map((e) => e.date));
	if (streak && streak.days > 1) {
		const endEvent = events.find((e) => e.date === streak.end) ?? events[events.length - 1];
		milestones.push({
			date: streak.end,
			eyebrow: `Longest streak: ${streak.days} days`,
			film: endEvent.film,
			detail: `${streak.start} to ${streak.end}`
		});
	}

	return milestones.sort((a, b) => a.date.localeCompare(b.date));
}
