import { languageName } from '$lib/film/language';
import { quantile } from '$lib/math';
import { byLanguage, type BarDatum } from '$lib/film/tally';
import { TMDB_POPULAR_VOTES } from '$lib/film/votes';
import { viewerLanguage, type Library } from '../library';
import type { EnrichedFilm } from '$lib/types';

/** TMDB's own vote count, the scale the obscurity spread and the vote-band rules are tuned to. */
export function tmdbVotes(library: Library): number[] {
	return library.slice
		.map((film) => film.tmdb?.voteCount)
		.filter((count): count is number => typeof count === 'number' && count > 0);
}

export interface Obscurity {
	/** Films with a TMDB vote count, the population the spread is taken over. */
	voted: number;
	median: number;
	lowerQuartile: number;
	popular: number;
}

/** The whole distribution of how widely seen the year was, in one number and a second below it. */
export function obscurity(library: Library): Obscurity | null {
	const counts = tmdbVotes(library);
	if (counts.length === 0) return null;
	return {
		voted: counts.length,
		median: quantile(counts, 0.5) as number,
		lowerQuartile: quantile(counts, 0.25) as number,
		popular: counts.filter((count) => count > TMDB_POPULAR_VOTES).length
	};
}

export interface Languages {
	/** The viewer's own language, the one the share is measured against. */
	label: string;
	/** Of the films with a language on record, the share not in the viewer's own. */
	share: number;
	count: number;
	own: number;
	/** Every distinct language among the year's films, the viewer's own included if present. */
	languages: number;
	/** The other languages, largest first. */
	bars: BarDatum[];
}

export function languageShare(library: Library): Languages | null {
	const spoken = library.slice.flatMap((film) => {
		const code = film.tmdb?.originalLanguage;
		return code ? [{ film, code }] : [];
	});
	if (spoken.length === 0) return null;
	const label = viewerLanguage(library);
	const own = spoken.filter(({ code }) => languageName(code) === label).length;
	const all = byLanguage(spoken.map(({ film }) => film));
	return {
		label,
		share: (spoken.length - own) / spoken.length,
		count: spoken.length - own,
		own,
		languages: all.length,
		bars: all.filter((datum) => datum.label !== label)
	};
}
