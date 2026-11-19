import { RELEASE_LOOKBACK_DAYS, shiftDays } from '$lib/dates';
import { tmdbMovieUrl, webHref } from '$lib/film/links';
import { getOrCreate } from '$lib/maps';
import {
	isTmdbMovie,
	type FilmReleases,
	type ReleaseKind,
	type TmdbMovie,
	type WatchlistFilm
} from '$lib/types';

/** Country used when the chosen one has no dates; most titles carry US dates first. */
const FALLBACK_REGION = 'US';

/** One dated release of a film in the chosen country. */
interface ReleaseDate {
	kind: ReleaseKind;
	/** ISO date, YYYY-MM-DD. */
	date: string;
	/** The country the date is from when the chosen one had none, else null. */
	fallbackRegion: string | null;
}

/** One country's dates, else the fallback country's; empty when neither has any. */
function regionReleases(releases: FilmReleases, region: string): ReleaseDate[] {
	const own = releases[region];
	const fallbackRegion = own ? null : FALLBACK_REGION;
	return (own ?? releases[FALLBACK_REGION] ?? []).map(([kind, date]) => ({
		kind,
		date,
		fallbackRegion
	}));
}

/** Why a film off the watchlist was recommended, and the release kinds the search covered. */
interface Recommended {
	score: number;
	reason: string;
	kinds: readonly ReleaseKind[];
}

/**
 * A film the calendar can show, with its link and date policy decided where it was built: a
 * watchlist row, or a recommendation with no Letterboxd page.
 */
export interface CalendarFilm {
	/** Stable identity across both kinds of film. */
	key: string;
	name: string;
	year: number | null;
	href: string | null;
	tmdb: TmdbMovie | null;
	/** Whether the fallback country's dates may stand in when the chosen country has none. */
	allowFallback: boolean;
	recommended?: Recommended;
}

/** A watchlist row: linked to its Letterboxd page, and shown with fallback dates. */
export function watchlistCalendarFilm(film: WatchlistFilm): CalendarFilm {
	return {
		key: film.tmdb ? String(film.tmdb.tmdbId) : film.uri,
		name: film.name,
		year: film.year,
		href: webHref(film.uri),
		tmdb: film.tmdb,
		allowFallback: true
	};
}

/**
 * A recommended upcoming film: linked to TMDB, since it has no Letterboxd page we know of, and
 * shown only with the chosen country's own dates, in the kinds that were searched.
 */
export function recommendedCalendarFilm(record: TmdbMovie, recommended: Recommended): CalendarFilm {
	return {
		key: String(record.tmdbId),
		name: record.title,
		year: record.year,
		href: tmdbMovieUrl(record.tmdbId),
		tmdb: record,
		allowFallback: false,
		recommended
	};
}

export interface CalendarEntry extends ReleaseDate {
	film: CalendarFilm;
}

/** A day cell of the month grid; `date` is null for the padding before the 1st and after the last. */
interface CalendarDay {
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

/** TMDB movie ids worth asking about: undated films and those released in the last two years. */
export function upcomingCandidates(watchlist: WatchlistFilm[], today: string): number[] {
	const cutoff = shiftDays(today, -RELEASE_LOOKBACK_DAYS);
	return watchlist.flatMap(({ tmdb }) =>
		isTmdbMovie(tmdb) && (!tmdb.releaseDate || tmdb.releaseDate >= cutoff) ? [tmdb.tmdbId] : []
	);
}

/**
 * Every release in `region` on or after `from`, by date and then title: of the picked `kinds`
 * for watchlist films, of the searched kinds for recommendations.
 */
export function calendarEntries(
	films: CalendarFilm[],
	cache: ReleaseCache,
	region: string,
	kinds: readonly ReleaseKind[],
	from: string
): CalendarEntry[] {
	return films
		.flatMap((film) => {
			const releases = isTmdbMovie(film.tmdb) ? cache.get(film.tmdb.tmdbId) : null;
			const shown = film.recommended?.kinds ?? kinds;
			return (releases ? regionReleases(releases, region) : [])
				.filter((release) => shown.includes(release.kind) && release.date >= from)
				.filter((release) => film.allowFallback || release.fallbackRegion === null)
				.map((release) => ({ film, ...release }));
		})
		.sort((a, b) => a.date.localeCompare(b.date) || a.film.name.localeCompare(b.film.name));
}

export const monthKey = (iso: string): string => iso.slice(0, 7);

/** The `YYYY-MM` month `step` months away. */
export function shiftMonth(month: string, step: number): string {
	const [year, index] = month.split('-').map(Number);
	return new Date(Date.UTC(year, index - 1 + step, 1)).toISOString().slice(0, 7);
}

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
		if (monthKey(entry.date) === month) getOrCreate(byDate, entry.date, () => []).push(entry);
	}
	const days: CalendarDay[] = Array.from({ length: lead }, () => ({ date: null, entries: [] }));
	for (let day = 1; day <= length; day++) {
		const date = `${month}-${String(day).padStart(2, '0')}`;
		days.push({ date, entries: byDate.get(date) ?? [] });
	}
	while (days.length % 7 !== 0) days.push({ date: null, entries: [] });
	return days;
}
