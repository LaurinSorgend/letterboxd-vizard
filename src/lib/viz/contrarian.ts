import type { EnrichedFilm } from '$lib/types';
import {
	extremes,
	gapsTo,
	IMDB,
	ROTTEN_TOMATOES,
	type RatingGap,
	type RatingSource
} from '$lib/film/ratings';

interface ContrarianSource {
	key: RatingSource['key'];
	label: string;
	/** Mean signed gap (yours − source) across films both rated; null with no overlap. */
	avgGap: number | null;
	/** Mean absolute gap across films both rated; null with no overlap. */
	meanAbsGap: number | null;
	count: number;
	over: RatingGap[];
	under: RatingGap[];
}

const TOP_N = 5;

const mean = (values: number[]): number | null =>
	values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

function summarize(source: RatingSource, label: string, films: EnrichedFilm[]): ContrarianSource {
	const gaps = gapsTo(films, source);
	return {
		key: source.key,
		label,
		avgGap: mean(gaps.map((g) => g.gap)),
		meanAbsGap: mean(gaps.map((g) => Math.abs(g.gap))),
		count: gaps.length,
		...extremes(gaps, TOP_N)
	};
}

/** Your signed gap against Rotten Tomatoes critics and IMDb users, kept separate. */
export function contrarianSources(films: EnrichedFilm[]): ContrarianSource[] {
	return [
		summarize(ROTTEN_TOMATOES, 'Rotten Tomatoes critics', films),
		summarize(IMDB, 'IMDb audiences', films)
	];
}

/** A single magnitude of disagreement: the mean absolute gap across every source with overlap. */
export function contrarianScore(sources: ContrarianSource[]): number | null {
	return mean(sources.flatMap((s) => (s.meanAbsGap === null ? [] : [s.meanAbsGap])));
}
