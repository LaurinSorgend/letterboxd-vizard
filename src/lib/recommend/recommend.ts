import { fetchRecommendations } from '$lib/api/endpoints';
import { tmdbIdsOf, type Recommendation, type Seed, type TmdbMovie } from '$lib/types';

/**
 * TMDB ids a recommendation must not suggest: every film watched, and the watchlist unless the
 * member asked to see it.
 */
export function excludedIds(
	library: { films: { tmdb: TmdbMovie | null }[]; watchlist: { tmdb: TmdbMovie | null }[] },
	includeWatchlist: boolean
): number[] {
	return [...tmdbIdsOf(library.films), ...(includeWatchlist ? [] : tmdbIdsOf(library.watchlist))];
}

/** Growing waits between retries: each request warms the cache, so the next resolves more records. */
const RETRY_DELAYS_MS = [1500, 3500, 7000];

const hasPending = (sets: Recommendation[][]): boolean =>
	sets.some((set) => set.some((r) => r.pending));

/**
 * Recommendations for each seed set, delivered through `update` as they settle. The server marks
 * a film `pending` (no countries, maybe no poster) when its record did not load in time; those
 * are re-requested a few times and filled in by TMDB id, and whatever is still pending after the
 * last retry is delivered as settled. A failed request counts as no recommendations. Stops as
 * soon as `isCurrent` turns false.
 */
export async function fetchRecommendationsSettled(
	seedSets: Seed[][],
	exclude: number[],
	update: (sets: Recommendation[][]) => void,
	isCurrent: () => boolean
): Promise<void> {
	const fetchAll = () =>
		Promise.all(seedSets.map((seeds) => fetchRecommendations(seeds, exclude).catch(() => [])));
	let sets = await fetchAll();
	if (!isCurrent()) return;
	update(sets);
	for (const wait of RETRY_DELAYS_MS) {
		if (!hasPending(sets)) return;
		await new Promise((resolve) => setTimeout(resolve, wait));
		if (!isCurrent()) return;
		const fresh = (await fetchAll()).flat();
		if (!isCurrent()) return;
		const resolved = new Map(fresh.filter((r) => !r.pending).map((r) => [r.tmdbId, r]));
		sets = sets.map((set) => set.map((r) => (r.pending ? (resolved.get(r.tmdbId) ?? r) : r)));
		update(sets);
	}
	if (!hasPending(sets)) return;
	update(sets.map((set) => set.map((r) => (r.pending ? { ...r, pending: false } : r))));
}
