import type { FilmReleases, ReleaseKind } from '$lib/releases/dates';
import type { FetchBudget } from './budget';
import { tmdbGet } from './tmdb';

interface TmdbReleaseDate {
	release_date?: string;
	type?: number;
}

interface TmdbCountryReleases {
	iso_3166_1?: string;
	release_dates?: TmdbReleaseDate[];
}

/** TMDB release types: 2 limited and 3 wide theatrical, 4 digital, 5 physical. */
const KIND_OF_TYPE: Record<number, ReleaseKind> = {
	2: 'theatrical',
	3: 'theatrical',
	4: 'digital',
	5: 'physical'
};

/** One country's distinct dated releases, premieres and TV airings dropped. */
function countryDates(entries: TmdbReleaseDate[]): [ReleaseKind, string][] {
	const seen = new Set<string>();
	const dates: [ReleaseKind, string][] = [];
	for (const entry of entries) {
		const kind = KIND_OF_TYPE[entry.type ?? 0];
		const date = entry.release_date?.slice(0, 10);
		if (!kind || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
		if (seen.has(`${kind}:${date}`)) continue;
		seen.add(`${kind}:${date}`);
		dates.push([kind, date]);
	}
	return dates;
}

/** Folds TMDB's per-country release list into the cached shape, leaving out undated countries. */
export function compactReleases(results: TmdbCountryReleases[]): FilmReleases {
	const releases: FilmReleases = {};
	for (const country of results) {
		const dates = countryDates(country.release_dates ?? []);
		if (country.iso_3166_1 && dates.length > 0) releases[country.iso_3166_1] = dates;
	}
	return releases;
}

/** Release dates in every country for one film: a single subrequest. */
export async function fetchReleases(budget: FetchBudget, id: number): Promise<FilmReleases> {
	const { results } = (await tmdbGet(budget, `/movie/${id}/release_dates`, {})) as {
		results?: TmdbCountryReleases[];
	};
	return compactReleases(results ?? []);
}
