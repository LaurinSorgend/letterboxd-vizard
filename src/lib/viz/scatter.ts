import type { EnrichedFilm } from '$lib/types';

export interface Point {
	film: EnrichedFilm;
	runtime: number;
	rating: number;
	/** Offset in rating units, so ten discrete rating steps do not stack into ten flat stripes. */
	jitter: number;
}

export interface Fit {
	slope: number;
	intercept: number;
	/** Pearson correlation of runtime against rating, −1 to 1. */
	r: number;
	n: number;
}

/** Shortest length counted as a feature; shorts are a different form with different expectations. */
const FEATURE_MINUTES = 40;
const JITTER = 0.18;

/** A stable offset hashed from the URI, so a point never jumps between renders. */
export function jitterFor(uri: string): number {
	let hash = 0;
	for (let i = 0; i < uri.length; i++) hash = (hash * 31 + uri.charCodeAt(i)) | 0;
	return ((hash >>> 0) / 0xffffffff) * 2 * JITTER - JITTER;
}

/**
 * Rated feature films with a known runtime. Series are excluded whatever their length: they carry
 * a whole-run estimate, a different unit, and a handful of them would dominate the fit on their own.
 */
export function runtimeRatingPoints(films: EnrichedFilm[]): Point[] {
	const points: Point[] = [];
	for (const film of films) {
		const runtime = film.tmdb?.runtime;
		if (film.rating === null || !runtime) continue;
		if (film.tmdb?.mediaType === 'tv' || runtime < FEATURE_MINUTES) continue;
		points.push({ film, runtime, rating: film.rating, jitter: jitterFor(film.uri) });
	}
	return points;
}

/** How many rated films the scatter leaves out, so the chart can say so rather than quietly drop them. */
export function excludedCount(films: EnrichedFilm[]): number {
	const rated = films.filter((film) => film.rating !== null && film.tmdb?.runtime);
	return rated.length - runtimeRatingPoints(films).length;
}

/** Least-squares line of rating on runtime, plus Pearson r; null when there is nothing to fit. */
export function linearFit(points: Point[]): Fit | null {
	const n = points.length;
	if (n < 2) return null;
	let meanX = 0;
	let meanY = 0;
	for (const p of points) {
		meanX += p.runtime / n;
		meanY += p.rating / n;
	}
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	for (const p of points) {
		const dx = p.runtime - meanX;
		const dy = p.rating - meanY;
		sxy += dx * dy;
		sxx += dx * dx;
		syy += dy * dy;
	}
	if (sxx === 0 || syy === 0) return null;
	const slope = sxy / sxx;
	return { slope, intercept: meanY - slope * meanX, r: sxy / Math.sqrt(sxx * syy), n };
}

/** Plain reading of a correlation, so a near-zero r is not mistaken for a result. */
export function describeFit(fit: Fit): string {
	const size = Math.abs(fit.r);
	if (size < 0.1) return 'essentially no relationship between length and how you rate';
	const strength = size < 0.3 ? 'a weak' : size < 0.5 ? 'a moderate' : 'a strong';
	const direction = fit.r > 0 ? 'longer films rating higher' : 'longer films rating lower';
	return `${strength} tendency towards ${direction}`;
}
