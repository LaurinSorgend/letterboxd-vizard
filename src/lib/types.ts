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

export interface Person {
	name: string;
	tmdbId: number | null;
	/** TMDB profile image path (e.g. /abc.jpg), null if none. */
	profilePath: string | null;
}

/** Compact metadata record stored in the server cache and returned by /api/enrich. */
export interface TmdbMovie {
	/** Negative ids are TheTVDB ids (mediaType 'tv' with no TMDB match). */
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	title: string;
	year: number | null;
	/** ISO 3166-1 alpha-2 codes. */
	countries: string[];
	originCountries: string[];
	genres: string[];
	/** Minutes: a film's length, or a series' estimated whole-run length. */
	runtime: number | null;
	/** ISO release date, or a series' first air date; null when TMDB has none. */
	releaseDate: string | null;
	originalLanguage: string | null;
	voteAverage: number | null;
	/** How many TMDB users rated it — a proxy for how widely the film has been seen. */
	voteCount: number | null;
	/** TMDB image path, or a full URL for TheTVDB artwork. */
	posterPath: string | null;
	directors: Person[];
	cast: Person[];
}

export interface EnrichRequestItem {
	name: string;
	year: number | null;
}

/** A watched film sent to /api/recommend as a recommendation seed. */
export interface Seed {
	tmdbId: number;
	rating: number;
}

/** A film joined with its TMDB metadata (null if TMDB had no match). */
export interface EnrichedFilm extends Film {
	tmdb: TmdbMovie | null;
}
