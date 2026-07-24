import codes from './country-codes.json';
import { avgRating } from './stats';
import { getOrCreate } from '$lib/collections';
import type { EnrichedFilm, TmdbMovie } from '$lib/types';

/** ISO 3166-1 numeric (world-atlas feature id) → alpha-2 (TMDB country code). */
export const numericToAlpha2 = codes as Record<string, string>;

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(alpha2: string): string {
	try {
		return regionNames.of(alpha2) ?? alpha2;
	} catch {
		return alpha2;
	}
}

/** The countries a record is attributed to: production countries, else origin countries. */
export function effectiveCountries(
	record: Pick<TmdbMovie, 'countries' | 'originCountries'>
): string[] {
	return record.countries.length ? record.countries : record.originCountries;
}

export interface CountryStat {
	code: string;
	name: string;
	films: EnrichedFilm[];
	count: number;
	ratedCount: number;
	avg: number | null;
}

/** Groups films by production country (falling back to origin country). */
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
