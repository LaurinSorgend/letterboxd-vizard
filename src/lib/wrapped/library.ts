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
}

export function datesIn(film: EnrichedFilm, year: number): string[] {
	return film.watchedDates.filter((date) => date.startsWith(`${year}-`)).sort();
}

export function entriesIn(film: EnrichedFilm, year: number): DiaryEntry[] {
	return film.entries
		.filter((entry) => entry.date.startsWith(`${year}-`))
		.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The primary subtag of the viewer's locale. "Not in English" is only a claim about the viewer
 * when the viewer speaks English, so the language frames measure against this instead.
 */
export function viewerLanguage(library: Library): string {
	return library.locale.split('-')[0];
}

export function speaksEnglish(library: Library): boolean {
	return viewerLanguage(library) === 'en';
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
		now: input.now ?? new Date()
	};
}
