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

/**
 * Generation of the TmdbMovie shape. Bump it when the shape or meaning of a record changes: the
 * server's record cache and the browser's saved snapshot both carry it, so neither serves records
 * built under the old shape. A bump refetches records by id; the server's (name, year) matches
 * are versioned on their own.
 */
export const RECORD_SCHEMA = 'v6';

/** Compact metadata record, as /api/enrich and /api/records answer it. */
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

/** A watchlist row joined with its TMDB record, or null when TMDB has no match. */
export interface WatchlistFilm extends WatchlistEntry {
	tmdb: TmdbMovie | null;
}

/** How a service offers a title, in TMDB's (JustWatch's) terms. */
export type OfferKind = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';

export const OFFER_KINDS: OfferKind[] = ['flatrate', 'free', 'ads', 'rent', 'buy'];

/** A streaming or rental service, e.g. Netflix or Apple TV. */
export interface Provider {
	id: number;
	name: string;
	/** TMDB image path of the service logo. */
	logoPath: string | null;
}

/** Where one title can be watched in one country, by kind of offer. */
export type RegionOffers = Record<OfferKind, Provider[]> & {
	/** TMDB's watch page for the title in that country, which links out to the services. */
	link: string | null;
};

/** One title sent to /api/providers. */
export interface ProviderRequestItem {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
}

/** Key a title's offers are stored under, client and server; TMDB numbers films and series separately. */
export const offersKey = (item: ProviderRequestItem): string => `${item.mediaType}:${item.tmdbId}`;

/** TMDB ids are positive; TheTVDB records are stored under negative ids, which TMDB never knows. */
export const isTmdbId = (id: number): boolean => id > 0;

/** TMDB ids of the items matched to a real TMDB record, skipping TheTVDB-only ones. */
export function tmdbIdsOf(items: { tmdb: TmdbMovie | null }[]): number[] {
	return items.flatMap((item) =>
		item.tmdb && isTmdbId(item.tmdb.tmdbId) ? [item.tmdb.tmdbId] : []
	);
}

/** An upcoming film found by TMDB discover, before its full record is fetched. */
export interface UpcomingCandidate {
	tmdbId: number;
	title: string;
	year: number | null;
	posterPath: string | null;
}

/** A film TMDB holds as a movie, the only kind with recommendations and release dates. */
export const isTmdbMovie = (tmdb: TmdbMovie | null | undefined): tmdb is TmdbMovie =>
	tmdb?.mediaType === 'movie' && isTmdbId(tmdb.tmdbId);

/** The release channels the calendar can filter by, in filter order. */
export const RELEASE_KINDS = ['theatrical', 'digital', 'physical'] as const;

export type ReleaseKind = (typeof RELEASE_KINDS)[number];

/** Every country's dated releases for one film: `[kind, YYYY-MM-DD]` pairs per ISO country. */
export type FilmReleases = Record<string, [ReleaseKind, string][]>;

/** A film /api/recommend suggests. */
export interface Recommendation {
	tmdbId: number;
	title: string;
	year: number | null;
	posterPath: string | null;
	countries: string[];
	/** This film's record could not load yet; re-request to fill it. */
	pending: boolean;
}

/** Most items one batch request may carry, on every batch endpoint. */
export const MAX_BATCH = 100;

/**
 * Upstream fetches one API request may spend unless the server sets FETCH_BUDGET. The client
 * sizes its batches against it.
 */
export const DEFAULT_FETCH_BUDGET = 40;

/** Seeds /api/recommend reads; it ignores any past this many. */
export const MAX_SEEDS = 25;

/** What every batch endpoint answers: one result per request item, in request order. */
export interface BatchAnswer<V> {
	results: (V | null)[];
	/** Indices of the request the client should send again. */
	pending: number[];
}

/** An ISO 3166-1 alpha-2 country code, as the region endpoints take it. */
export const REGION_PATTERN = /^[A-Z]{2}$/;

/** One film item of a member's RSS feed, as /api/feed answers it: a diary entry, or a review with its viewing. */
export interface FeedEntry {
	/** Canonical film page, without the member or the repeat-viewing suffix. */
	uri: string;
	name: string;
	year: number | null;
	/** ISO watch date; null for a review logged without one. */
	date: string | null;
	rating: number | null;
	rewatch: boolean;
	liked: boolean;
	review: string | null;
}

/** A Letterboxd username, as Letterboxd allows them. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{2,30}$/;
