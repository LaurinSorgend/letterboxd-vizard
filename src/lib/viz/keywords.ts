import { grouped, type BarDatum } from '$lib/film/tally';
import type { EnrichedFilm } from '$lib/types';

/**
 * TMDB tags that catalogue the credits or the production rather than name a theme. They ride on
 * thousands of films apiece, so left in they would crowd out the motifs this chart exists to show.
 */
const STOPLIST = new Set(['duringcreditsstinger', 'aftercreditsstinger', 'woman director']);

/** Keywords carried by at least two of your films, most common first. */
export function byKeyword(films: EnrichedFilm[]): BarDatum[] {
	return grouped(films, (film) =>
		(film.tmdb?.keywords ?? []).filter((keyword) => !STOPLIST.has(keyword))
	).filter((datum) => datum.count > 1);
}

/** Six discriminable size/colour steps, darkest and largest at step 5. */
const CLOUD_STEPS = 6;

/**
 * Size step 0–5 for a keyword. The square root is deliberate: raw counts have a long tail, and a
 * linear scale would leave one giant word beside a hundred identical specks. It also keeps the
 * size honest: a keyword on a hundred films reads as a few steps up, not ten times the area.
 */
export function sizeStep(count: number, max: number): number {
	if (max <= 1) return 0;
	const share = Math.sqrt(count) / Math.sqrt(max);
	return Math.min(CLOUD_STEPS - 1, Math.floor(share * CLOUD_STEPS));
}
