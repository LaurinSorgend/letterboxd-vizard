import { byGenre, byPerson, type BarDatum } from '$lib/viz/stats';
import type { CollectionParts, DiaryEntry, EnrichedFilm, WatchlistEntry } from '$lib/types';

export interface LibraryInput {
	films: EnrichedFilm[];
	year: number;
	watchlist?: WatchlistEntry[];
	collections?: CollectionParts[];
	locale?: string;
	now?: Date;
}

/** Everything a frame or a verdict is allowed to read, assembled once per deck. */
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
	/** BCP-47 tag from the browser, lowercased; 'en' when unknown. */
	locale: string;
	now: Date;
	/**
	 * Tallies half a dozen facts and verdicts each want over the same slice. Computed on first
	 * call and kept, so grouping the year's cast — the dearest of them — happens once per deck.
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
	return film.watchedDates.filter((date) => date.startsWith(`${year}-`)).sort();
}

export function entriesIn(film: EnrichedFilm, year: number): DiaryEntry[] {
	return film.entries
		.filter((entry) => entry.date.startsWith(`${year}-`))
		.sort((a, b) => a.date.localeCompare(b.date));
}

/** How many posters a frame's poster row holds. Facts cap their `shownFilms` at this. */
export const POSTER_ROW = 6;

/** The poster row's default pick: the best-rated films, ties broken by name. */
export function bestRated(films: EnrichedFilm[], limit = POSTER_ROW): EnrichedFilm[] {
	return [...films]
		.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name))
		.slice(0, limit);
}

/** Diary entries in `year` marked as rewatches — counted per viewing, not per film. */
export function rewatchesIn(films: EnrichedFilm[], year: number): number {
	return films.reduce(
		(sum, film) => sum + entriesIn(film, year).filter((entry) => entry.rewatch).length,
		0
	);
}

/**
 * The language the viewer watches in, taken to be the one they watched most. A browser locale
 * says where someone is, not what they read subtitles for, and a year spent mostly in Japanese
 * is nobody's foreign year. The locale is only the fallback when nothing carries a language.
 */
export function viewerLanguage(library: Library): string {
	const counts = new Map<string, number>();
	for (const film of library.slice) {
		const spoken = film.tmdb?.originalLanguage;
		if (spoken) counts.set(spoken, (counts.get(spoken) ?? 0) + 1);
	}
	const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	return ranked[0]?.[0] ?? library.locale.split('-')[0];
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
		locale: (input.locale ?? 'en').toLowerCase(),
		now: input.now ?? new Date(),
		directors: once(() => byPerson(slice, 'directors')),
		cast: once(() => byPerson(slice, 'cast')),
		genres: once(() => byGenre(slice))
	};
}
