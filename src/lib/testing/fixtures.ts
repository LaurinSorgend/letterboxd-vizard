import type { DiaryEntry, EnrichedFilm, Film, OmdbRatings, TmdbMovie } from '$lib/types';

/** Test-only builders. Nothing under `src/routes` or `src/lib/viz` may import this module. */
let counter = 0;

export function tmdb(over: Partial<TmdbMovie> = {}): TmdbMovie {
	counter += 1;
	return {
		tmdbId: counter,
		mediaType: 'movie',
		title: `Movie ${counter}`,
		year: 2020,
		countries: [],
		originCountries: [],
		genres: [],
		runtime: 100,
		releaseDate: '2020-01-01',
		originalLanguage: 'en',
		voteAverage: 7,
		voteCount: 5000,
		posterPath: null,
		directors: [],
		cast: [],
		collection: null,
		keywords: [],
		imdbId: null,
		...over
	};
}

export function omdb(over: Partial<OmdbRatings> = {}): OmdbRatings {
	return { imdbRating: null, imdbVotes: null, rottenTomatoes: null, metascore: null, ...over };
}

/** Diary dates and their per-entry ratings, built together so the two never drift apart. */
export function watched(
	dates: string[],
	rating: number | null = null
): Pick<Film, 'watchedDates' | 'entries'> {
	const entries: DiaryEntry[] = dates.map((date, i) => ({ date, rating, rewatch: i > 0 }));
	return { watchedDates: [...dates], entries };
}

export function film(over: Partial<EnrichedFilm> = {}): EnrichedFilm {
	counter += 1;
	return {
		uri: `https://boxd.it/${counter}`,
		name: `Film ${counter}`,
		year: 2020,
		rating: null,
		liked: false,
		review: null,
		watchedDates: [],
		entries: [],
		rewatch: false,
		tags: [],
		tmdb: null,
		omdb: null,
		...over
	};
}
