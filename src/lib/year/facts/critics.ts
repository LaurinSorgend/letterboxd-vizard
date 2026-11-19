import {
	extremes,
	METACRITIC,
	ROTTEN_TOMATOES,
	starGapsTo,
	TMDB,
	YOURS,
	type StarGap
} from '$lib/film/ratings';
import type { Library } from '../library';
import type { EnrichedFilm } from '$lib/types';

export interface CriticGap {
	film: EnrichedFilm;
	/** Your stars. */
	rating: number;
	/** The critics' own 0-100 number. */
	critics: number;
	source: 'Metascore' | 'Rotten Tomatoes';
	/** In points on the critics' scale, your stars counted at twenty each; positive when you were kinder. */
	gap: number;
	kinder: number;
	harsher: number;
}

/** One film's disagreement, before the year-wide tallies either side of it are known. */
type Scored = Omit<CriticGap, 'kinder' | 'harsher'>;

function scored(library: Library): Scored[] {
	const gaps: Scored[] = [];
	for (const film of library.slice) {
		const yours = YOURS.of(film);
		const metascore = METACRITIC.of(film);
		const critics = metascore ?? ROTTEN_TOMATOES.of(film);
		if (film.rating === null || yours === null || critics === null) continue;
		gaps.push({
			film,
			rating: film.rating,
			critics,
			source: metascore === null ? 'Rotten Tomatoes' : 'Metascore',
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
	return {
		...widest,
		kinder: gaps.filter((gap) => gap.gap > 0).length,
		harsher: gaps.filter((gap) => gap.gap < 0).length
	};
}

export interface CrowdGap {
	/** The film you rated furthest above TMDB's average, in stars. */
	over: StarGap | null;
	/** The film you rated furthest below it. */
	under: StarGap | null;
}

export function crowdGap(library: Library): CrowdGap {
	const gaps = extremes(starGapsTo(library.slice, TMDB), 1);
	return { over: gaps.over[0] ?? null, under: gaps.under[0] ?? null };
}
