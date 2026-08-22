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
		now: input.now ?? new Date()
	};
}
