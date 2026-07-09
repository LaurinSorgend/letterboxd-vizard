import codes from './country-codes.json';
import type { EnrichedFilm } from '$lib/types';

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
		const countries = film.tmdb.countries.length ? film.tmdb.countries : film.tmdb.originCountries;
		for (const code of new Set(countries)) {
			let stat = stats.get(code);
			if (!stat) {
				stat = { code, name: countryName(code), films: [], count: 0, ratedCount: 0, avg: null };
				stats.set(code, stat);
			}
			stat.films.push(film);
			stat.count += 1;
		}
	}
	for (const stat of stats.values()) {
		const ratings = stat.films.map((f) => f.rating).filter((r): r is number => r !== null);
		stat.ratedCount = ratings.length;
		if (ratings.length > 0) {
			stat.avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
		}
	}
	return stats;
}
