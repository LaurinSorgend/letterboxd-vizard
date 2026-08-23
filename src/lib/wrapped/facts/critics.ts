import type { Library } from '../library';
import type { EnrichedFilm } from '$lib/types';

/** Below thirty points the two are agreeing, and a frame about agreement is not a frame. */
const MIN_GAP = 30;

export interface CriticGap {
	film: EnrichedFilm;
	/** Both on a 0-100 scale: your stars times twenty against the critics' own number. */
	yours: number;
	critics: number;
	source: 'Metascore' | 'Rotten Tomatoes';
	/** Positive when you were the kinder of the two. */
	gap: number;
	kinder: number;
	harsher: number;
}

/** One film's disagreement, before the year-wide tallies either side of it are known. */
type Scored = Omit<CriticGap, 'kinder' | 'harsher'>;

function scored(library: Library): Scored[] {
	const gaps: Scored[] = [];
	for (const film of library.slice) {
		if (film.rating === null) continue;
		const metascore = film.omdb?.metascore;
		const tomatoes = film.omdb?.rottenTomatoes;
		const critics = metascore ?? tomatoes;
		if (critics == null) continue;
		const yours = film.rating * 20;
		gaps.push({
			film,
			yours,
			critics,
			source: metascore == null ? 'Rotten Tomatoes' : 'Metascore',
			gap: yours - critics
		});
	}
	return gaps;
}

/** The film you and the critics stood furthest apart on, in whichever direction was wider. */
export function widestCriticGap(library: Library): CriticGap | null {
	const gaps = scored(library);
	if (gaps.length === 0) return null;
	const widest = gaps.reduce((worst, gap) =>
		Math.abs(gap.gap) > Math.abs(worst.gap) ? gap : worst
	);
	if (Math.abs(widest.gap) < MIN_GAP) return null;
	return {
		...widest,
		kinder: gaps.filter((gap) => gap.gap > 0).length,
		harsher: gaps.filter((gap) => gap.gap < 0).length
	};
}
