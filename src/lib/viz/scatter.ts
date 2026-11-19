import { isSeries } from '$lib/film/runtime';
import { linearFit as fitLine } from '$lib/math';
import type { EnrichedFilm } from '$lib/types';
import { ratingJitter } from './chart/plot';

export interface Point {
	film: EnrichedFilm;
	runtime: number;
	rating: number;
	/** Offset in rating units, so ten discrete rating steps do not stack into ten flat stripes. */
	jitter: number;
}

interface Fit {
	slope: number;
	intercept: number;
	/** Pearson correlation of runtime against rating, −1 to 1. */
	r: number;
	n: number;
}

/** Shortest length counted as a feature; shorts are a different form with different expectations. */
const FEATURE_MINUTES = 40;
/**
 * Rated feature films with a known runtime. Series are excluded whatever their length: they carry
 * a whole-run estimate, a different unit, and a handful of them would dominate the fit on their own.
 */
export function runtimeRatingPoints(films: EnrichedFilm[]): Point[] {
	const points: Point[] = [];
	for (const film of films) {
		const runtime = film.tmdb?.runtime;
		if (film.rating === null || !runtime) continue;
		if (isSeries(film) || runtime < FEATURE_MINUTES) continue;
		points.push({ film, runtime, rating: film.rating, jitter: ratingJitter(film.uri) });
	}
	return points;
}

/** Least-squares line of rating on runtime, plus Pearson r; null when there is nothing to fit. */
export function linearFit(points: Point[]): Fit | null {
	const fit = fitLine(
		points.map((p) => p.runtime),
		points.map((p) => p.rating)
	);
	return fit && { ...fit, n: points.length };
}

/** Plain reading of a correlation, so a near-zero r is not mistaken for a result. */
export function describeFit(fit: Fit): string {
	const size = Math.abs(fit.r);
	if (size < 0.1) return 'essentially no relationship between length and how you rate';
	const strength = size < 0.3 ? 'a weak' : size < 0.5 ? 'a moderate' : 'a strong';
	const direction = fit.r > 0 ? 'longer films rating higher' : 'longer films rating lower';
	return `${strength} tendency towards ${direction}`;
}
