/** The release channels the calendar can filter by, in filter order. */
export const RELEASE_KINDS = ['theatrical', 'digital', 'physical'] as const;

export type ReleaseKind = (typeof RELEASE_KINDS)[number];

/** Country used when the chosen one has no dates; most titles carry US dates first. */
export const FALLBACK_REGION = 'US';

/** Every country's dated releases for one film: `[kind, YYYY-MM-DD]` pairs per ISO country. */
export type FilmReleases = Record<string, [ReleaseKind, string][]>;

/** One dated release of a film in the chosen country. */
export interface ReleaseDate {
	kind: ReleaseKind;
	/** ISO date, YYYY-MM-DD. */
	date: string;
	/** The country the date is from when the chosen one had none, else null. */
	fallbackRegion: string | null;
}

/** One country's dates, else the fallback country's; empty when neither has any. */
export function regionReleases(releases: FilmReleases, region: string): ReleaseDate[] {
	const own = releases[region];
	const fallbackRegion = own ? null : FALLBACK_REGION;
	return (own ?? releases[FALLBACK_REGION] ?? []).map(([kind, date]) => ({
		kind,
		date,
		fallbackRegion
	}));
}
