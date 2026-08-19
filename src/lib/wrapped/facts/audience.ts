import { byLanguage, type BarDatum } from '$lib/viz/stats';
import { viewerLanguage, type Library } from '../library';

const MIN_VOTED = 25;
const MIN_LANGUAGED = 15;
const MIN_SHARE = 0.1;

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

export interface Obscurity {
	median: number;
	lowerQuartile: number;
	overTenThousand: number;
	counted: number;
}

/** Nearest-rank quantile on an ascending array; `fraction: 0.5` is this codebase's median. */
function quantile(sorted: number[], fraction: number): number {
	return sorted[Math.floor(sorted.length * fraction)];
}

/** The whole distribution of how widely seen the year was, in one number and a second below it. */
export function obscurity(library: Library): Obscurity | null {
	const votes = library.slice
		.map((film) => film.tmdb?.voteCount)
		.filter((count): count is number => typeof count === 'number' && count > 0)
		.sort((a, b) => a - b);
	if (votes.length < MIN_VOTED) return null;
	return {
		median: quantile(votes, 0.5),
		lowerQuartile: quantile(votes, 0.25),
		overTenThousand: votes.filter((count) => count > 10_000).length,
		counted: votes.length
	};
}

export interface Languages {
	/** The viewer's own language, the one the share is measured against. */
	language: string;
	label: string;
	share: number;
	count: number;
	own: number;
	largest: BarDatum | null;
	/** Capped at five for the bar chart; count with `count`. */
	shownBars: BarDatum[];
}

export function languageShare(library: Library): Languages | null {
	const spoken = library.slice.filter((film) => film.tmdb?.originalLanguage);
	if (spoken.length < MIN_LANGUAGED) return null;
	const language = viewerLanguage(library);
	const own = spoken.filter((film) => film.tmdb?.originalLanguage === language).length;
	const count = spoken.length - own;
	const share = count / spoken.length;
	if (share < MIN_SHARE) return null;

	const label = languageNames.of(language) ?? language;
	const bars = byLanguage(spoken).filter((datum) => datum.label !== label);
	return {
		language,
		label,
		share,
		count,
		own,
		largest: bars[0] ?? null,
		shownBars: bars.slice(0, 5)
	};
}
