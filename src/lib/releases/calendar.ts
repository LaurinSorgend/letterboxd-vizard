import type { ReleaseDate, ReleaseKind, WatchlistFilm } from '$lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Digital and disc releases trail the cinema run, so a film this old can still have one coming. */
const LOOKBACK_DAYS = 2 * 365;

export interface CalendarEntry {
	film: WatchlistFilm;
	kind: ReleaseKind;
	date: string;
	/** Country of the date, which is the fallback country when the chosen one had none. */
	region: string;
}

/** A day cell of the month grid; `date` is null for the padding before the 1st and after the last. */
export interface CalendarDay {
	date: string | null;
	entries: CalendarEntry[];
}

export type ReleasesOf = (tmdbId: number) => ReleaseDate[] | undefined;

/** Today in the viewer's time zone, as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shiftDays(iso: string, days: number): string {
	return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** TMDB movie ids worth asking about: undated films and those released in the last two years. */
export function upcomingCandidates(watchlist: WatchlistFilm[], today: string): number[] {
	const cutoff = shiftDays(today, -LOOKBACK_DAYS);
	return watchlist.flatMap((film) => {
		const tmdb = film.tmdb;
		if (!tmdb || tmdb.mediaType !== 'movie' || tmdb.tmdbId <= 0) return [];
		return !tmdb.releaseDate || tmdb.releaseDate >= cutoff ? [tmdb.tmdbId] : [];
	});
}

/** Every release of the picked kinds on or after `from`, by date and then title. */
export function calendarEntries(
	watchlist: WatchlistFilm[],
	releasesOf: ReleasesOf,
	kinds: ReleaseKind[],
	from: string
): CalendarEntry[] {
	const entries = watchlist.flatMap((film) =>
		(film.tmdb ? (releasesOf(film.tmdb.tmdbId) ?? []) : [])
			.filter((release) => kinds.includes(release.kind) && release.date >= from)
			.map((release) => ({ film, ...release }))
	);
	return entries.sort(
		(a, b) => a.date.localeCompare(b.date) || a.film.name.localeCompare(b.film.name)
	);
}

/** `YYYY-MM` of an ISO date. */
export const monthOf = (iso: string): string => iso.slice(0, 7);

/** The month after (or before, for a negative step) a `YYYY-MM` month. */
export function shiftMonth(month: string, step: number): string {
	const [year, index] = month.split('-').map(Number);
	const date = new Date(Date.UTC(year, index - 1 + step, 1));
	return date.toISOString().slice(0, 7);
}

/** Weeks of a month, Monday first, padded to whole weeks, with each day's entries attached. */
export function monthGrid(month: string, entries: CalendarEntry[]): CalendarDay[] {
	const [year, index] = month.split('-').map(Number);
	const length = new Date(Date.UTC(year, index, 0)).getUTCDate();
	const lead = (new Date(Date.UTC(year, index - 1, 1)).getUTCDay() + 6) % 7;
	const byDate = new Map<string, CalendarEntry[]>();
	for (const entry of entries) {
		if (monthOf(entry.date) === month)
			byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
	}
	const days: CalendarDay[] = Array.from({ length: lead }, () => ({ date: null, entries: [] }));
	for (let day = 1; day <= length; day++) {
		const date = `${month}-${String(day).padStart(2, '0')}`;
		days.push({ date, entries: byDate.get(date) ?? [] });
	}
	while (days.length % 7 !== 0) days.push({ date: null, entries: [] });
	return days;
}
