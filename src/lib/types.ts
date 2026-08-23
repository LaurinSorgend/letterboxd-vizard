/** TMDB names every franchise "<name> Collection"; the suffix reads as noise in a list or a sentence. */
export const collectionName = (raw: string): string => raw.replace(/ Collection$/, '');

/** One diary row. Letterboxd records a rating per viewing, not just a current rating per film. */
export interface DiaryEntry {
	date: string;
	rating: number | null;
	rewatch: boolean;
}

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
	/** The same diary rows as `watchedDates`, carrying the rating and rewatch flag of each. */
	entries: DiaryEntry[];
	rewatch: boolean;
	tags: string[];
}

export interface Profile {
	username: string;
	givenName: string;
	dateJoined: string;
	location: string;
}

/** A watchlist row: a film you mean to watch, and when you said so. */
export interface WatchlistEntry {
	uri: string;
	name: string;
	year: number | null;
	/** ISO date the film was added, or null on exports without the column. */
	added: string | null;
}

export interface LetterboxdData {
	films: Film[];
	watchlist: WatchlistEntry[];
	profile: Profile | null;
}

export interface Person {
	name: string;
	tmdbId: number | null;
	/** TMDB profile image path (e.g. /abc.jpg), null if none. */
	profilePath: string | null;
}

/** A TMDB franchise, e.g. "The Matrix Collection". */
export interface Collection {
	id: number;
	name: string;
	posterPath: string | null;
}

/** A franchise's full size, from TMDB's collection endpoint, so "five of six" is sayable. */
export interface CollectionParts {
	id: number;
	name: string;
	total: number;
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
	/** How many TMDB users rated it, a proxy for how widely the film has been seen. */
	voteCount: number | null;
	/** TMDB image path, or a full URL for TheTVDB artwork. */
	posterPath: string | null;
	directors: Person[];
	cast: Person[];
	/** The franchise this belongs to; null for standalone films and every series. */
	collection: Collection | null;
	/** TMDB theme tags, lowercase; empty when TMDB has none, which is common. */
	keywords: string[];
	/** tt-prefixed IMDb id, the key OMDb ratings are looked up by; null for TheTVDB-only records. */
	imdbId: string | null;
}

/** Ratings pulled from OMDb by IMDb id: IMDb's own score, Rotten Tomatoes, and Metacritic. */
export interface OmdbRatings {
	/** 0-10 scale, IMDb users. */
	imdbRating: number | null;
	imdbVotes: number | null;
	/** 0-100 scale (Tomatometer, critics). */
	rottenTomatoes: number | null;
	/** 0-100 scale, Metacritic critics. */
	metascore: number | null;
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
	/** OMDb ratings keyed by tmdb.imdbId; null when unmatched, unconfigured, or OMDb had nothing. */
	omdb: OmdbRatings | null;
}
