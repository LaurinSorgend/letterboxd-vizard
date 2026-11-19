import { languageName } from '$lib/film/language';
import { getOrCreate } from '$lib/maps';
import { byGenre, byPerson, type BarDatum } from '$lib/film/tally';
import { inYear } from './calendar';
import type { CollectionParts, DiaryEntry, EnrichedFilm, WatchlistEntry } from '$lib/types';

export interface LibraryInput {
	films: EnrichedFilm[];
	year: number;
	watchlist?: WatchlistEntry[];
	collections?: CollectionParts[];
	locale?: string;
	now?: Date;
}

/** Everything a frame or a verdict is allowed to read, assembled once per year. */
export interface Library {
	/** Every film in the export, not just the year. */
	all: EnrichedFilm[];
	year: number;
	/** Films with at least one diary entry inside `year`. */
	slice: EnrichedFilm[];
	/** Every diary date inside `year`, ascending, repeats kept. */
	dates: string[];
	watchlist: WatchlistEntry[];
	collections: Map<number, CollectionParts>;
	/** BCP-47 tag, lowercased: the browser's unless given, 'en' where there is no browser. */
	locale: string;
	now: Date;
	/**
	 * Tallies half a dozen facts and verdicts each want over the same slice. Computed on first
	 * call and kept, so grouping the year's cast — the dearest of them — happens once per year.
	 */
	directors: () => BarDatum[];
	cast: () => BarDatum[];
	genres: () => BarDatum[];
}

function once<T>(compute: () => T): () => T {
	let value: T | undefined;
	let done = false;
	return () => {
		if (!done) {
			value = compute();
			done = true;
		}
		return value as T;
	};
}

export function datesIn(film: EnrichedFilm, year: number): string[] {
	return film.watchedDates.filter((date) => inYear(date, year)).sort();
}

export function entriesIn(film: EnrichedFilm, year: number): DiaryEntry[] {
	return film.entries
		.filter((entry) => inYear(entry.date, year))
		.sort((a, b) => a.date.localeCompare(b.date));
}

/** Distinct films logged in each calendar year of the export. */
export function filmsLoggedPerYear(films: EnrichedFilm[]): Map<number, number> {
	const seen = new Map<number, Set<string>>();
	for (const film of films) {
		for (const date of film.watchedDates) {
			const year = Number.parseInt(date.slice(0, 4), 10);
			if (Number.isFinite(year)) getOrCreate(seen, year, () => new Set<string>()).add(film.uri);
		}
	}
	return new Map([...seen].map(([year, logged]) => [year, logged.size]));
}

/** True while the year is still running, so the copy can say the picture is not final. */
export function isRunning(library: Library): boolean {
	return library.year === library.now.getFullYear();
}

/**
 * The language the viewer watches in, by display name: the one they watched most. A browser
 * locale says where someone is, not what they read subtitles for, and a year spent mostly in
 * Japanese is nobody's foreign year. The locale only breaks a tie, or stands in when nothing
 * carries a language.
 */
export function viewerLanguage(library: Library): string {
	const counts = new Map<string, number>();
	for (const film of library.slice) {
		const code = film.tmdb?.originalLanguage;
		if (code) counts.set(languageName(code), (counts.get(languageName(code)) ?? 0) + 1);
	}
	const local = languageName(library.locale.split('-')[0]);
	const ranked = [...counts].sort(
		(a, b) =>
			b[1] - a[1] || Number(b[0] === local) - Number(a[0] === local) || a[0].localeCompare(b[0])
	);
	return ranked[0]?.[0] ?? local;
}

/** Today as a diary date, the end any running measure stops at. */
export function todayIso(library: Library): string {
	return library.now.toISOString().slice(0, 10);
}

function browserLocale(): string {
	return typeof navigator === 'undefined' ? 'en' : navigator.language;
}

export function buildLibrary(input: LibraryInput): Library {
	const slice = input.films.filter((film) => datesIn(film, input.year).length > 0);
	return {
		all: input.films,
		year: input.year,
		slice,
		dates: slice.flatMap((film) => datesIn(film, input.year)).sort(),
		watchlist: input.watchlist ?? [],
		collections: new Map((input.collections ?? []).map((parts) => [parts.id, parts])),
		locale: (input.locale ?? browserLocale()).toLowerCase(),
		now: input.now ?? new Date(),
		directors: once(() => byPerson(slice, 'directors')),
		cast: once(() => byPerson(slice, 'cast')),
		genres: once(() => byGenre(slice))
	};
}
