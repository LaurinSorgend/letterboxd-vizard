import { fetchRecords, fetchUpcoming } from '$lib/ingest/enrich';
import type { EnrichedFilm, TmdbMovie, WatchlistFilm } from '$lib/types';
import { watchedTmdbIds } from '$lib/viz/seeds';
import type { CalendarFilm } from './calendar';
import type { ReleaseKind } from './dates';
import { buildTasteProfile, scoreUpcoming, topPeople, type TasteProfile } from './similarity';

/** Stage of an upcoming-film recommendation run. */
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
	onProgress('searching', 0, 0);
	const candidates = await fetchUpcoming(region, kinds, topPeople(profile), signal);
	const exclude = new Set([...watchedTmdbIds(films), ...watchedTmdbIds(watchlist)]);
	const ids = candidates.map((c) => c.tmdbId).filter((id) => !exclude.has(id));
	onProgress('enriching', 0, ids.length);
	const records = await fetchRecords(
		ids,
		(done) => onProgress('enriching', done, ids.length),
		signal
	);
	const found = [...records.values()].filter((r): r is TmdbMovie => r !== null);
	return scoreUpcoming(profile, found, exclude).map(({ record, score, reason }) => ({
		name: record.title,
		year: record.year,
		uri: null,
		tmdb: record,
		recommended: { score, reason }
	}));
}
