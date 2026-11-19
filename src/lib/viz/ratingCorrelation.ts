import { pearson } from '$lib/math';
import type { EnrichedFilm } from '$lib/types';
import { SOURCES, YOURS, type RatingSource } from '$lib/film/ratings';

interface CorrelationCell {
	r: number | null;
	n: number;
}

interface CorrelationMatrix {
	axes: RatingSource[];
	cells: CorrelationCell[][];
}

/** Below a handful of shared points a correlation coefficient is not meaningful. */
const MIN_OVERLAP = 5;

/** Pairwise-complete correlation among your rating and every external source. */
export function ratingCorrelation(films: EnrichedFilm[]): CorrelationMatrix {
	const rows = films
		.filter((film) => YOURS.of(film) !== null)
		.map((film) => SOURCES.map((source) => source.of(film)));
	const n = SOURCES.length;
	const cells: CorrelationCell[][] = Array.from({ length: n }, () => Array(n).fill(null));

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			if (i === j) {
				cells[i][j] = { r: 1, n: rows.filter((row) => row[i] !== null).length };
				continue;
			}
			const xs: number[] = [];
			const ys: number[] = [];
			for (const row of rows) {
				if (row[i] !== null && row[j] !== null) {
					xs.push(row[i] as number);
					ys.push(row[j] as number);
				}
			}
			cells[i][j] = { r: xs.length < MIN_OVERLAP ? null : pearson(xs, ys), n: xs.length };
		}
	}
	return { axes: SOURCES, cells };
}

/** The external source whose rating tracks your own most closely, for a "best predictor" readout. */
export function bestPredictor(matrix: CorrelationMatrix): { label: string; r: number } | null {
	let best: { label: string; r: number } | null = null;
	for (let j = 1; j < matrix.axes.length; j++) {
		const r = matrix.cells[0][j].r;
		if (r === null) continue;
		if (best === null || r > best.r) best = { label: matrix.axes[j].label, r };
	}
	return best;
}
