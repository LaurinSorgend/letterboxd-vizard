import codes from './country-codes.json';
import type { TmdbMovie } from '$lib/types';

/** ISO 3166-1 numeric (world-atlas feature id) → alpha-2 (TMDB country code). */
export const numericToAlpha2 = codes as Record<string, string>;

/** Every ISO 3166-1 alpha-2 code the world map knows. */
export const COUNTRY_CODES: string[] = [...new Set(Object.values(numericToAlpha2))];

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
