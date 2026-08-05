import type { EnrichedFilm } from '$lib/types';

export interface ContrarianGap {
	film: EnrichedFilm;
	/** Both 0-100: your stars ×20 against the source's own scale. */
	yours: number;
	source: number;
	gap: number;
}

export interface ContrarianSource {
	key: 'rt' | 'imdb';
	label: string;
	/** Mean signed gap (yours − source) across films both rated; null with no overlap. */
	avgGap: number | null;
	count: number;
	over: ContrarianGap[];
	under: ContrarianGap[];
}

const TOP_N = 5;

function gapsFor(
	films: EnrichedFilm[],
	sourceOf: (film: EnrichedFilm) => number | null
): ContrarianGap[] {
	const gaps: ContrarianGap[] = [];
	for (const film of films) {
		if (film.rating === null) continue;
		const source = sourceOf(film);
		if (source === null) continue;
		const yours = film.rating * 20;
		gaps.push({ film, yours, source, gap: yours - source });
	}
	return gaps;
}

function summarize(
	key: ContrarianSource['key'],
	label: string,
	gaps: ContrarianGap[]
): ContrarianSource {
	const sorted = [...gaps].sort((a, b) => b.gap - a.gap);
	const avgGap = gaps.length === 0 ? null : gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length;
	return {
		key,
		label,
		avgGap,
		count: gaps.length,
		over: sorted.slice(0, TOP_N).filter((g) => g.gap > 0),
		under: sorted
			.slice(-TOP_N)
			.filter((g) => g.gap < 0)
			.reverse()
	};
}

/** Your signed gap against Rotten Tomatoes critics and IMDb users, kept separate. */
export function contrarianSources(films: EnrichedFilm[]): ContrarianSource[] {
	return [
		summarize(
			'rt',
			'Rotten Tomatoes critics',
			gapsFor(films, (f) => f.omdb?.rottenTomatoes ?? null)
		),
		summarize(
			'imdb',
			'IMDb audiences',
			gapsFor(films, (f) => (f.omdb?.imdbRating != null ? f.omdb.imdbRating * 10 : null))
		)
	];
}

/** A single magnitude of disagreement: the mean absolute gap across every source with overlap. */
export function contrarianScore(sources: ContrarianSource[]): number | null {
	const known = sources.filter(
		(s): s is ContrarianSource & { avgGap: number } => s.avgGap !== null
	);
	if (known.length === 0) return null;
	return known.reduce((sum, s) => sum + Math.abs(s.avgGap), 0) / known.length;
}
