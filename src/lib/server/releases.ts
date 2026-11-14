import type { ReleaseDate, ReleaseKind } from '$lib/types';
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

/** Country used when the requested one has no dates; most titles carry US dates first. */
export const FALLBACK_REGION = 'US';

/** Every country's dated releases for one film, as cached: `[kind, YYYY-MM-DD]` pairs. */
export type FilmReleases = Record<string, [ReleaseKind, string][]>;

/** Folds TMDB's per-country release list into the cached shape, dropping premieres and TV airings. */
export function compactReleases(results: TmdbCountryReleases[]): FilmReleases {
	const releases: FilmReleases = {};
	for (const country of results) {
		const region = country.iso_3166_1;
		if (!region) continue;
		const seen = new Set<string>();
		const dates: [ReleaseKind, string][] = [];
		for (const entry of country.release_dates ?? []) {
			const kind = KIND_OF_TYPE[entry.type ?? 0];
			const date = entry.release_date?.slice(0, 10);
			if (!kind || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
			if (seen.has(`${kind}:${date}`)) continue;
			seen.add(`${kind}:${date}`);
			dates.push([kind, date]);
		}
		if (dates.length > 0) releases[region] = dates;
	}
	return releases;
}

/** One country's dates, else the fallback country's; empty when neither has any. */
export function regionReleases(releases: FilmReleases, region: string): ReleaseDate[] {
	const used = releases[region] ? region : FALLBACK_REGION;
	return (releases[used] ?? []).map(([kind, date]) => ({ kind, date, region: used }));
}

/** Release dates in every country for one film: a single subrequest. */
export async function fetchReleases(budget: FetchBudget, id: number): Promise<FilmReleases> {
	const { results } = (await tmdbGet(budget, `/movie/${id}/release_dates`, {})) as {
		results?: TmdbCountryReleases[];
	};
	return compactReleases(results ?? []);
}
