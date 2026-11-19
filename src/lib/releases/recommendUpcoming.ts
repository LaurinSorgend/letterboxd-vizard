import { fetchRecords, fetchUpcoming } from '$lib/api/endpoints';
import { excludedIds } from '$lib/recommend/recommend';
import type { EnrichedFilm, ReleaseKind, TmdbMovie, WatchlistFilm } from '$lib/types';
import { recommendedCalendarFilm, type CalendarFilm } from './calendar';
import { buildTasteProfile, scoreUpcoming, topPeople, type TasteProfile } from './similarity';

export type RecommendPhase = 'searching' | 'enriching';

function isEmpty(profile: TasteProfile): boolean {
	return (
		profile.directors.size === 0 &&
		profile.cast.size === 0 &&
		profile.keywords.size === 0 &&
		profile.collections.size === 0
	);
}

/** Upcoming films scored against the viewer's favourites, skipping anything watched or watchlisted. */
export async function recommendUpcoming(
	films: EnrichedFilm[],
	watchlist: WatchlistFilm[],
	region: string,
	kinds: ReleaseKind[],
	onProgress: (phase: RecommendPhase, done: number, total: number) => void,
	signal: AbortSignal
): Promise<CalendarFilm[]> {
	const profile = buildTasteProfile(films);
	if (isEmpty(profile)) return [];
	const candidates = await fetchUpcoming(region, kinds, topPeople(profile), signal);
	const exclude = new Set(excludedIds({ films, watchlist }, false));
	const ids = candidates.map((c) => c.tmdbId).filter((id) => !exclude.has(id));
	onProgress('enriching', 0, ids.length);
	const records = await fetchRecords(
		ids,
		(done) => onProgress('enriching', done, ids.length),
		signal
	);
	const found = [...records.values()].filter((r): r is TmdbMovie => r !== null);
	return scoreUpcoming(profile, found).map(({ record, score, reason }) =>
		recommendedCalendarFilm(record, { score, reason, kinds })
	);
}
