import { DAY_MS } from '$lib/math';
import { isTmdbId, type FilmReleases, type ReleaseKind } from '$lib/types';
import type { BatchLookup } from './batch';
import type { FetchBudget } from './budget';
import { jsonCache } from './cache';
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
const KIND_OF_TYPE: Readonly<Record<number, ReleaseKind>> = {
	2: 'theatrical',
	3: 'theatrical',
	4: 'digital',
	5: 'physical'
};

/** TMDB's release types for `kind`, as discover's `with_release_type` takes them (`2|3`). */
export function releaseTypesOf(kind: ReleaseKind): string {
	return Object.entries(KIND_OF_TYPE)
		.filter(([, of]) => of === kind)
		.map(([type]) => type)
		.join('|');
}

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
async function fetchReleases(budget: FetchBudget, id: number): Promise<FilmReleases> {
	const { results } = (await tmdbGet(budget, `/movie/${id}/release_dates`, {})) as {
		results?: TmdbCountryReleases[];
	};
	return compactReleases(results ?? []);
}

/** Release dates per movie id; studios move and add dates often enough to refetch weekly. */
export const releases: BatchLookup<number, number, FilmReleases> = {
	keyOf: (id) => (isTmdbId(id) ? id : null),
	cache: jsonCache<number, FilmReleases>({ table: 'releases', key: 'tmdb_id', ttlMs: 7 * DAY_MS }),
	fetchOne: fetchReleases,
	label: 'tmdb release dates'
};
