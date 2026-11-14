import type { ReleaseDate, ReleaseKind } from '$lib/types';

/** Country used when the chosen one has no dates; most titles carry US dates first. */
export const FALLBACK_REGION = 'US';

/** Every country's dated releases for one film: `[kind, YYYY-MM-DD]` pairs per ISO country. */
export type FilmReleases = Record<string, [ReleaseKind, string][]>;

/** One country's dates, else the fallback country's; empty when neither has any. */
export function regionReleases(releases: FilmReleases, region: string): ReleaseDate[] {
	const used = releases[region] ? region : FALLBACK_REGION;
	return (releases[used] ?? []).map(([kind, date]) => ({ kind, date, region: used }));
}
