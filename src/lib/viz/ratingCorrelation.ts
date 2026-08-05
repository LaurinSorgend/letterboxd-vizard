import type { EnrichedFilm } from '$lib/types';

export interface CorrelationAxis {
	key: string;
	label: string;
}

export const CORRELATION_AXES: CorrelationAxis[] = [
	{ key: 'yours', label: 'You' },
	{ key: 'tmdb', label: 'TMDB' },
	{ key: 'imdb', label: 'IMDb' },
	{ key: 'rt', label: 'Rotten Tomatoes' },
	{ key: 'metacritic', label: 'Metacritic' }
];

export interface CorrelationCell {
	r: number | null;
	n: number;
}

export interface CorrelationMatrix {
	axes: CorrelationAxis[];
	cells: CorrelationCell[][];
}

/** One row per film, one value per axis (0-100 scale), null where that source has no rating. */
function seriesOf(films: EnrichedFilm[]): (number | null)[][] {
	return films
		.filter((film) => film.rating !== null)
		.map((film) => [
			(film.rating as number) * 20,
			film.tmdb?.voteAverage != null ? film.tmdb.voteAverage * 10 : null,
			film.omdb?.imdbRating != null ? film.omdb.imdbRating * 10 : null,
			film.omdb?.rottenTomatoes ?? null,
			film.omdb?.metascore ?? null
		]);
}

/** Pearson correlation; null below a handful of points, where a coefficient is not meaningful. */
const MIN_OVERLAP = 5;

function pearson(xs: number[], ys: number[]): number | null {
	const n = xs.length;
	if (n < MIN_OVERLAP) return null;
	let meanX = 0;
	let meanY = 0;
	for (let i = 0; i < n; i++) {
		meanX += xs[i] / n;
		meanY += ys[i] / n;
	}
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	for (let i = 0; i < n; i++) {
		const dx = xs[i] - meanX;
		const dy = ys[i] - meanY;
		sxy += dx * dy;
		sxx += dx * dx;
		syy += dy * dy;
	}
	if (sxx === 0 || syy === 0) return null;
	return sxy / Math.sqrt(sxx * syy);
}

/** Pairwise-complete correlation among your rating and every external source, in a 0-100 scale. */
export function ratingCorrelation(films: EnrichedFilm[]): CorrelationMatrix {
	const rows = seriesOf(films);
	const n = CORRELATION_AXES.length;
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
			cells[i][j] = { r: pearson(xs, ys), n: xs.length };
		}
	}
	return { axes: CORRELATION_AXES, cells };
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
