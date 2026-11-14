import type { ReleaseKind } from '$lib/releases/dates';
import type { UpcomingCandidate } from '$lib/types';
import type { FetchBudget } from './budget';
import { tmdbGet } from './tmdb';

const HORIZON_DAYS = 90;
const PRIMARY_LOOKBACK_DAYS = 730;
const MIN_POPULARITY = 1.5;

const RELEASE_TYPES: Record<ReleaseKind, string> = {
	theatrical: '2|3',
	digital: '4',
	physical: '5'
};

interface DiscoverResult {
	id: number;
	title?: string;
	release_date?: string;
	poster_path?: string | null;
	popularity?: number;
}

function shiftDays(day: string, days: number): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
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
		with_release_type: RELEASE_TYPES[kind],
		'release_date.gte': today,
		'release_date.lte': shiftDays(today, HORIZON_DAYS),
		'primary_release_date.gte': shiftDays(today, -PRIMARY_LOOKBACK_DAYS),
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
	const year = Number.parseInt(result.release_date?.slice(0, 4) ?? '', 10);
	return {
		tmdbId: result.id,
		title: result.title ?? '',
		year: Number.isFinite(year) ? year : null,
		posterPath: result.poster_path ?? null
	};
}

/** One page of films with a release of `kind` in `region` within the next 90 days. */
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
