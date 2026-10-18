import { effectiveCountries } from '$lib/viz/countries';
import { hashString, seeded } from '$lib/viz/seeded';
import { compareSpectrum, type Swatch } from '$lib/viz/colors';
import { imageUrl } from '$lib/viz/images';
import type { OfferKind, Provider, RegionOffers, WatchlistFilm } from '$lib/types';

/** What a film's offers in the chosen country must include to stay in view. */
export type Availability = 'any' | 'stream' | 'free' | 'rent' | 'none';

export type WatchSort =
	| 'added-desc'
	| 'added-asc'
	| 'release-desc'
	| 'release-asc'
	| 'rating'
	| 'popularity'
	| 'runtime-asc'
	| 'runtime-desc'
	| 'title'
	| 'shuffle'
	| 'colour';

/** A film's dominant poster colour, or undefined while it has not been read. */
export type SwatchOf = (film: WatchlistFilm) => Swatch | undefined;

/** The poster the wall shows, which is also the image the colour sort reads. */
export function posterUrl(film: WatchlistFilm): string | null {
	return imageUrl(film.tmdb?.posterPath ?? null, 'w185');
}

export interface WatchFilters {
	query: string;
	availability: Availability;
	/** Provider ids; when any are picked, availability only counts these services. */
	services: number[];
	mediaType: 'all' | 'movie' | 'tv';
	genre: string;
	language: string;
	country: string;
	fromYear: number | null;
	toYear: number | null;
	maxRuntime: number | null;
	minRating: number | null;
}

export const NO_FILTERS: WatchFilters = {
	query: '',
	availability: 'any',
	services: [],
	mediaType: 'all',
	genre: '',
	language: '',
	country: '',
	fromYear: null,
	toYear: null,
	maxRuntime: null,
	minRating: null
};

/** Offers for a film: undefined while still loading, null when it has none in the country. */
export type OffersOf = (film: WatchlistFilm) => RegionOffers | null | undefined;

export const STREAM_KINDS: OfferKind[] = ['flatrate', 'free', 'ads'];

const KINDS: Record<Exclude<Availability, 'none'>, OfferKind[]> = {
	any: ['flatrate', 'free', 'ads', 'rent', 'buy'],
	stream: STREAM_KINDS,
	free: ['free', 'ads'],
	rent: ['rent', 'buy']
};

/** The services offering a film by any of `kinds`, deduplicated, in TMDB's display order. */
export function providersOf(
	offers: RegionOffers | null | undefined,
	kinds: OfferKind[]
): Provider[] {
	if (!offers) return [];
	const seen = new Map<number, Provider>();
	for (const kind of kinds) for (const p of offers[kind]) if (!seen.has(p.id)) seen.set(p.id, p);
	return [...seen.values()];
}

function offeredBy(offers: RegionOffers | null, kinds: OfferKind[], services: number[]): boolean {
	const providers = providersOf(offers, kinds);
	return services.length === 0
		? providers.length > 0
		: providers.some((p) => services.includes(p.id));
}

function matchesAvailability(film: WatchlistFilm, filters: WatchFilters, offersOf: OffersOf) {
	const { availability, services } = filters;
	if (availability === 'any' && services.length === 0) return true;
	const offers = offersOf(film);
	if (offers === undefined) return false;
	if (availability === 'none') return !offeredBy(offers, STREAM_KINDS, services);
	return offeredBy(offers, KINDS[availability], services);
}

function releaseYear(film: WatchlistFilm): number | null {
	return film.tmdb?.year ?? film.year;
}

function matchesQuery(film: WatchlistFilm, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	const people = [...(film.tmdb?.directors ?? []), ...(film.tmdb?.cast ?? [])];
	return [film.name, film.tmdb?.title ?? '', ...people.map((p) => p.name)].some((text) =>
		text.toLowerCase().includes(needle)
	);
}

function matchesFacets(film: WatchlistFilm, filters: WatchFilters): boolean {
	const tmdb = film.tmdb;
	if (filters.mediaType !== 'all' && (tmdb?.mediaType ?? 'movie') !== filters.mediaType)
		return false;
	if (filters.genre && !tmdb?.genres.includes(filters.genre)) return false;
	if (filters.language && tmdb?.originalLanguage !== filters.language) return false;
	if (filters.country && !countriesOf(film).includes(filters.country)) return false;
	const year = releaseYear(film);
	if (filters.fromYear !== null && (year === null || year < filters.fromYear)) return false;
	if (filters.toYear !== null && (year === null || year > filters.toYear)) return false;
	if (filters.maxRuntime !== null && (!tmdb?.runtime || tmdb.runtime > filters.maxRuntime))
		return false;
	return filters.minRating === null || (tmdb?.voteAverage ?? 0) >= filters.minRating;
}

export function countriesOf(film: WatchlistFilm): string[] {
	return film.tmdb ? effectiveCountries(film.tmdb) : [];
}

export function filterWatchlist(
	films: WatchlistFilm[],
	filters: WatchFilters,
	offersOf: OffersOf
): WatchlistFilm[] {
	return films.filter(
		(film) =>
			matchesQuery(film, filters.query) &&
			matchesFacets(film, filters) &&
			matchesAvailability(film, filters, offersOf)
	);
}

/** Missing values sort last whichever way the list runs. */
function byNumber(value: (film: WatchlistFilm) => number | null | undefined, descending: boolean) {
	return (a: WatchlistFilm, b: WatchlistFilm) => {
		const x = value(a) ?? null;
		const y = value(b) ?? null;
		if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
		return descending ? y - x : x - y;
	};
}

function releaseKey(film: WatchlistFilm): number | null {
	const date = film.tmdb?.releaseDate;
	if (date) return Date.parse(date);
	const year = releaseYear(film);
	return year === null ? null : Date.UTC(year, 0, 1);
}

function addedKey(film: WatchlistFilm): number | null {
	return film.added ? Date.parse(film.added) : null;
}

function comparator(sort: WatchSort, seed: number, swatchOf: SwatchOf) {
	switch (sort) {
		case 'added-desc':
			return byNumber(addedKey, true);
		case 'added-asc':
			return byNumber(addedKey, false);
		case 'release-desc':
			return byNumber(releaseKey, true);
		case 'release-asc':
			return byNumber(releaseKey, false);
		case 'rating':
			return byNumber((f) => f.tmdb?.voteAverage, true);
		case 'popularity':
			return byNumber((f) => f.tmdb?.voteCount, true);
		case 'runtime-asc':
			return byNumber((f) => f.tmdb?.runtime, false);
		case 'runtime-desc':
			return byNumber((f) => f.tmdb?.runtime, true);
		case 'title':
			return () => 0;
		case 'shuffle':
			return byNumber((f) => seeded(hashString(f.uri) + seed), false);
		case 'colour':
			return (a: WatchlistFilm, b: WatchlistFilm) => compareSpectrum(swatchOf(a), swatchOf(b));
	}
}

/** Sorted copy; ties, and the title sort itself, fall back to the film's name. */
export function sortWatchlist(
	films: WatchlistFilm[],
	sort: WatchSort,
	seed = 0,
	swatchOf: SwatchOf = () => undefined
): WatchlistFilm[] {
	const compare = comparator(sort, seed, swatchOf);
	return [...films].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
}

export interface ServiceCount {
	provider: Provider;
	films: number;
}

/** Services streaming at least one watchlist film, most films first. */
export function serviceCounts(films: WatchlistFilm[], offersOf: OffersOf): ServiceCount[] {
	const counts = new Map<number, ServiceCount>();
	for (const film of films) {
		for (const provider of providersOf(offersOf(film), STREAM_KINDS)) {
			const entry = counts.get(provider.id) ?? { provider, films: 0 };
			entry.films += 1;
			counts.set(provider.id, entry);
		}
	}
	return [...counts.values()].sort(
		(a, b) => b.films - a.films || a.provider.name.localeCompare(b.provider.name)
	);
}
