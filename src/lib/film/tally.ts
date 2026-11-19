import { getOrCreate } from '$lib/maps';
import { imageUrl, letterboxdPersonUrl, tmdbCollectionUrl, tmdbPersonUrl } from './links';
import { languageName } from './language';
import { libraryMinutes } from './runtime';
import { collectionName } from '$lib/format';
import { OBSCURE_VOTES, votes } from './votes';
import { countryName, effectiveCountries } from './countries';
import type { Collection, EnrichedFilm, Person } from '$lib/types';

export interface BarDatum {
	/** The group's identity, unique within its tally; the label is only what is shown. */
	key: string;
	label: string;
	count: number;
	avg: number | null;
	/** How many of `films` form the bar's highlighted segment. */
	highlight?: { count: number };
	image?: string | null;
	imageLarge?: string | null;
	href?: string | null;
	films: EnrichedFilm[];
}

export function avgRating(films: EnrichedFilm[]): number | null {
	const ratings = films.map((f) => f.rating).filter((r): r is number => r !== null);
	if (ratings.length === 0) return null;
	return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

export function totalRuntimeMinutes(films: EnrichedFilm[]): number {
	return films.reduce((sum, f) => sum + libraryMinutes(f), 0);
}

/** Share (0–1) of films with a vote count that are deep cuts, or null if none have one. */
export function obscurityShare(films: EnrichedFilm[]): number | null {
	const counts = films.map(votes).filter((count) => count > 0);
	return counts.length === 0
		? null
		: counts.filter((count) => count < OBSCURE_VOTES).length / counts.length;
}

/** Films grouped by every key they carry, count-desc; a film counts once per distinct key. */
export function grouped(films: EnrichedFilm[], keysOf: (f: EnrichedFilm) => string[]): BarDatum[] {
	const groups = new Map<string, EnrichedFilm[]>();
	for (const film of films) {
		for (const key of new Set(keysOf(film))) {
			getOrCreate(groups, key, () => []).push(film);
		}
	}
	return [...groups]
		.map(([label, group]) => ({
			key: label,
			label,
			count: group.length,
			avg: avgRating(group),
			films: group
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function byGenre(films: EnrichedFilm[]): BarDatum[] {
	return grouped(films, (f) => f.tmdb?.genres ?? []);
}

export function byLanguage(films: EnrichedFilm[]): BarDatum[] {
	return grouped(films, (f) =>
		f.tmdb?.originalLanguage ? [languageName(f.tmdb.originalLanguage)] : []
	);
}

/**
 * A person's identity across films: the TMDB id, since TMDB has several people sharing a name and
 * pooling them would merge their films into one bogus person. The rare person without an id is
 * known by name.
 */
export const personKey = (person: Pick<Person, 'tmdbId' | 'name'>): string =>
	person.tmdbId !== null ? `id:${person.tmdbId}` : `name:${person.name}`;

/** One bar per person, keyed by `personKey`, so namesakes stay apart. */
export function byPerson(films: EnrichedFilm[], role: 'directors' | 'cast'): BarDatum[] {
	interface PersonGroup {
		key: string;
		name: string;
		tmdbId: number | null;
		films: EnrichedFilm[];
		profilePath: string | null;
	}
	const groups = new Map<string, PersonGroup>();
	for (const film of films) {
		const seen = new Set<string>();
		for (const person of film.tmdb?.[role] ?? []) {
			const key = personKey(person);
			if (seen.has(key)) continue;
			seen.add(key);
			const group = getOrCreate(groups, key, () => ({
				key,
				name: person.name,
				tmdbId: person.tmdbId,
				films: [],
				profilePath: null
			}));
			group.profilePath ??= person.profilePath;
			group.films.push(film);
		}
	}

	// A bare name-slug lands on whoever owns it on Letterboxd, so it is only safe when the name is
	// unique in this library; anyone sharing a name here links to their unambiguous TMDB page instead.
	const nameCounts = new Map<string, number>();
	for (const { name } of groups.values()) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);

	const kind = role === 'directors' ? 'director' : 'actor';
	return [...groups.values()]
		.map((group) => ({
			key: group.key,
			label: group.name,
			count: group.films.length,
			avg: avgRating(group.films),
			image: imageUrl(group.profilePath, 'w92'),
			imageLarge: imageUrl(group.profilePath, 'w185'),
			href:
				group.tmdbId !== null && (nameCounts.get(group.name) ?? 0) > 1
					? tmdbPersonUrl(group.tmdbId)
					: letterboxdPersonUrl(kind, group.name),
			films: group.films
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Franchises you have seen more than one film of, most-watched first. A single film from a
 * collection says nothing about following the franchise, so those groups drop out.
 */
export function byCollection(films: EnrichedFilm[]): BarDatum[] {
	const groups = new Map<number, { collection: Collection; films: EnrichedFilm[] }>();
	for (const film of films) {
		const collection = film.tmdb?.collection;
		if (!collection) continue;
		getOrCreate(groups, collection.id, () => ({ collection, films: [] })).films.push(film);
	}
	return [...groups.values()]
		.filter((group) => group.films.length > 1)
		.map(({ collection, films: group }) => ({
			key: String(collection.id),
			label: collectionName(collection.name),
			count: group.length,
			avg: avgRating(group),
			image: imageUrl(collection.posterPath, 'w92'),
			imageLarge: imageUrl(collection.posterPath, 'w185'),
			href: tmdbCollectionUrl(collection.id),
			films: group
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** How many TMDB-matched films belong to any franchise at all, and how many were matched. */
export function collectionShare(films: EnrichedFilm[]): { inCollection: number; total: number } {
	const matched = films.filter((film) => film.tmdb);
	return {
		inCollection: matched.filter((film) => film.tmdb?.collection).length,
		total: matched.length
	};
}

export interface CountryStat {
	code: string;
	name: string;
	films: EnrichedFilm[];
	count: number;
	ratedCount: number;
	avg: number | null;
}

export function aggregateCountries(films: EnrichedFilm[]): Map<string, CountryStat> {
	const stats = new Map<string, CountryStat>();
	for (const film of films) {
		if (!film.tmdb) continue;
		for (const code of new Set(effectiveCountries(film.tmdb))) {
			const stat = getOrCreate(stats, code, () => ({
				code,
				name: countryName(code),
				films: [],
				count: 0,
				ratedCount: 0,
				avg: null
			}));
			stat.films.push(film);
			stat.count += 1;
		}
	}
	for (const stat of stats.values()) {
		stat.ratedCount = stat.films.filter((f) => f.rating !== null).length;
		stat.avg = avgRating(stat.films);
	}
	return stats;
}
