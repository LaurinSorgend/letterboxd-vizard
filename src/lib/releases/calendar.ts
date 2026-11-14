import { isTmdbMovie, type TmdbMovie, type WatchlistFilm } from '$lib/types';
import { regionReleases, type FilmReleases, type ReleaseDate, type ReleaseKind } from './dates';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Digital and disc releases trail the cinema run, so a film this old can still have one coming. */
const LOOKBACK_DAYS = 2 * 365;

/** Why a film off the watchlist was recommended. */
export interface Recommended {
	score: number;
	reason: string;
}

/** A film the calendar can show: a watchlist row, or a recommendation with no Letterboxd link. */
export interface CalendarFilm {
	name: string;
	year: number | null;
	uri: string | null;
	tmdb: TmdbMovie | null;
	recommended?: Recommended;
}

export interface CalendarEntry extends ReleaseDate {
	film: CalendarFilm;
}

/** A day cell of the month grid; `date` is null for the padding before the 1st and after the last. */
export interface CalendarDay {
	date: string | null;
	entries: CalendarEntry[];
}

/** Each film's dates in every country, null when TMDB has none; films not looked up are absent. */
export type ReleaseCache = ReadonlyMap<number, FilmReleases | null>;

/** Today in the viewer's time zone, as YYYY-MM-DD. */
export function localToday(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shiftDays(iso: string, days: number): string {
	return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** TMDB movie ids worth asking about: undated films and those released in the last two years. */
export function upcomingCandidates(watchlist: WatchlistFilm[], today: string): number[] {
	const cutoff = shiftDays(today, -LOOKBACK_DAYS);
	return watchlist.flatMap(({ tmdb }) =>
		isTmdbMovie(tmdb) && (!tmdb.releaseDate || tmdb.releaseDate >= cutoff) ? [tmdb.tmdbId] : []
	);
}

/** Orders entries by date and then title, in place. */
export function sortEntries(entries: CalendarEntry[]): CalendarEntry[] {
	return entries.sort(
		(a, b) => a.date.localeCompare(b.date) || a.film.name.localeCompare(b.film.name)
	);
}

/**
 * Every release of the picked kinds in `region` on or after `from`, by date and then title.
 * Recommended films only show dates from `region` itself, never the fallback country's.
 */
export function calendarEntries(
	films: CalendarFilm[],
	cache: ReleaseCache,
	region: string,
	kinds: readonly ReleaseKind[],
	from: string
): CalendarEntry[] {
	const entries = films.flatMap((film) => {
		const releases = isTmdbMovie(film.tmdb) ? cache.get(film.tmdb.tmdbId) : null;
		return (releases ? regionReleases(releases, region) : [])
			.filter((release) => kinds.includes(release.kind) && release.date >= from)
			.filter((release) => !film.recommended || release.fallbackRegion === null)
			.map((release) => ({ film, ...release }));
	});
	return sortEntries(entries);
}

/** The `YYYY-MM` month an ISO date falls in. */
export const monthKey = (iso: string): string => iso.slice(0, 7);

/** The `YYYY-MM` month `step` months away. */
export function shiftMonth(month: string, step: number): string {
	const [year, index] = month.split('-').map(Number);
	return new Date(Date.UTC(year, index - 1 + step, 1)).toISOString().slice(0, 7);
}

/** Keeps a month within `[first, last]`. */
export function clampMonth(month: string, first: string, last: string): string {
	if (month < first) return first;
	return month > last ? last : month;
}

/** Month of the first entry after `month`, or null when nothing comes later. */
export function nextReleaseMonth(entries: CalendarEntry[], month: string): string | null {
	const next = entries.find((entry) => monthKey(entry.date) > month);
	return next ? monthKey(next.date) : null;
}

/** Weeks of a month, Monday first, padded to whole weeks, with each day's entries attached. */
export function monthGrid(month: string, entries: CalendarEntry[]): CalendarDay[] {
	const [year, index] = month.split('-').map(Number);
	const length = new Date(Date.UTC(year, index, 0)).getUTCDate();
	const lead = (new Date(Date.UTC(year, index - 1, 1)).getUTCDay() + 6) % 7;
	const byDate = new Map<string, CalendarEntry[]>();
	for (const entry of entries) {
		if (monthKey(entry.date) === month)
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
