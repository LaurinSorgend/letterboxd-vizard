import { RELEASE_LOOKBACK_DAYS, shiftDays } from '$lib/dates';
import type { ReleaseKind, UpcomingCandidate } from '$lib/types';
import { DAY_MS } from '$lib/math';
import type { FetchBudget } from './budget';
import { jsonCache } from './cache';
import { yearOf } from '$lib/dates';
import { releaseTypesOf } from './releases';
import { tmdbGet } from './tmdb';

const HORIZON_DAYS = 90;
const MIN_POPULARITY = 1.5;

interface DiscoverResult {
	id: number;
	title?: string;
	release_date?: string;
	poster_path?: string | null;
	popularity?: number;
}

/** TMDB discover query for one release kind in one region, `today` being YYYY-MM-DD in UTC. */
export function discoverParams(
	region: string,
	kind: ReleaseKind,
	page: number,
	today: string,
	people?: number[]
): Record<string, string> {
	const params: Record<string, string> = {
		region,
		with_release_type: releaseTypesOf(kind),
		'release_date.gte': today,
		'release_date.lte': shiftDays(today, HORIZON_DAYS),
		'primary_release_date.gte': shiftDays(today, -RELEASE_LOOKBACK_DAYS),
		sort_by: 'popularity.desc',
		include_adult: 'false',
		include_video: 'false',
		without_genres: '10770',
		page: String(page)
	};
	if (people && people.length > 0) params.with_people = people.join('|');
	return params;
}

function toCandidate(result: DiscoverResult): UpcomingCandidate {
	return {
		tmdbId: result.id,
		title: result.title ?? '',
		year: yearOf(result.release_date),
		posterPath: result.poster_path ?? null
	};
}

/** One page of films with a release of `kind` in `region` before the horizon. */
export async function discoverUpcoming(
	budget: FetchBudget,
	region: string,
	kind: ReleaseKind,
	page: number,
	people?: number[]
): Promise<UpcomingCandidate[]> {
	const today = new Date().toISOString().slice(0, 10);
	const { results } = (await tmdbGet(
		budget,
		'/discover/movie',
		discoverParams(region, kind, page, today, people)
	)) as { results: DiscoverResult[] };
	return results
		.filter((r) => r.poster_path && (r.popularity ?? 0) >= MIN_POPULARITY)
		.map(toCandidate);
}

/** The popular pages per region and kind; the upcoming slate shifts daily. */
export const popularCache = jsonCache<string, UpcomingCandidate[]>({
	table: 'upcoming',
	key: 'cache_key',
	ttlMs: DAY_MS
});
