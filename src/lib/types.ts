/** A film from the Letterboxd export, merged across CSVs and keyed by Letterboxd URI. */
export interface Film {
	uri: string;
	name: string;
	year: number | null;
	rating: number | null;
	liked: boolean;
	review: string | null;
	/** ISO dates from the diary; empty if the film was never diary-logged. */
	watchedDates: string[];
	rewatch: boolean;
	tags: string[];
}

export interface Profile {
	username: string;
	givenName: string;
	dateJoined: string;
	location: string;
}

export interface LetterboxdData {
	films: Film[];
	watchlist: { uri: string; name: string; year: number | null }[];
	profile: Profile | null;
}

/** Compact TMDB record stored in the server cache and returned by /api/enrich. */
export interface TmdbMovie {
	tmdbId: number;
	title: string;
	year: number | null;
	/** ISO 3166-1 alpha-2 codes. */
	countries: string[];
	originCountries: string[];
	genres: string[];
	runtime: number | null;
	originalLanguage: string | null;
	voteAverage: number | null;
	posterPath: string | null;
	directors: string[];
	cast: string[];
}

export interface EnrichRequestItem {
	name: string;
	year: number | null;
}

export type EnrichResult = { movie: TmdbMovie } | { movie: null };

/** A film joined with its TMDB metadata (null if TMDB had no match). */
export interface EnrichedFilm extends Film {
	tmdb: TmdbMovie | null;
}
