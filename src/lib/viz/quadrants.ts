import { jitterFor } from './scatter';
import { combinedVoteCount } from './stats';
import type { EnrichedFilm } from '$lib/types';

export type Quadrant = 'popular-loved' | 'popular-disliked' | 'obscure-loved' | 'obscure-disliked';

export const QUADRANT_LABELS: Record<Quadrant, string> = {
	'popular-loved': 'Popular favorites',
	'popular-disliked': 'Popular, not for you',
	'obscure-loved': 'Hidden gems',
	'obscure-disliked': 'Skippable obscurities'
};

export interface QuadrantPoint {
	film: EnrichedFilm;
	popularity: number;
	rating: number;
	quadrant: Quadrant;
	jitter: number;
}

/** Rated 3.5★ or higher counts as loved, same border Letterboxd's own heart nudges people toward. */
export const LIKE_THRESHOLD = 3.5;

export interface QuadrantAxes {
	popularityMedian: number;
	ratingThreshold: number;
}

/** Rated films with a vote count from TMDB or IMDb; everything else has no place on either axis. */
function eligible(
	films: EnrichedFilm[]
): { film: EnrichedFilm; popularity: number; rating: number }[] {
	const rows: { film: EnrichedFilm; popularity: number; rating: number }[] = [];
	for (const film of films) {
		const popularity = combinedVoteCount(film);
		if (film.rating === null || popularity <= 0) continue;
		rows.push({ film, popularity, rating: film.rating });
	}
	return rows;
}

/** How many rated films the chart leaves out for want of a TMDB vote count. */
export function excludedCount(films: EnrichedFilm[]): number {
	return films.filter((f) => f.rating !== null).length - eligible(films).length;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function classify(popularity: number, rating: number, axes: QuadrantAxes): Quadrant {
	const popular = popularity >= axes.popularityMedian;
	const loved = rating >= axes.ratingThreshold;
	if (popular) return loved ? 'popular-loved' : 'popular-disliked';
	return loved ? 'obscure-loved' : 'obscure-disliked';
}

/**
 * Every rated, matched film sorted into a quadrant by whether its combined vote count sits above
 * or below the library's own median — so "popular" is relative to this library — and by whether
 * your rating clears a fixed 3.5★ "loved it" bar rather than another library-relative split.
 */
export function quadrantPoints(films: EnrichedFilm[]): {
	points: QuadrantPoint[];
	axes: QuadrantAxes;
} {
	const rows = eligible(films);
	if (rows.length === 0) {
		return { points: [], axes: { popularityMedian: 0, ratingThreshold: LIKE_THRESHOLD } };
	}
	const axes: QuadrantAxes = {
		popularityMedian: median(rows.map((r) => r.popularity)),
		ratingThreshold: LIKE_THRESHOLD
	};
	const points = rows.map((r) => ({
		film: r.film,
		popularity: r.popularity,
		rating: r.rating,
		quadrant: classify(r.popularity, r.rating, axes),
		jitter: jitterFor(r.film.uri)
	}));
	return { points, axes };
}

export interface QuadrantSummary {
	quadrant: Quadrant;
	label: string;
	count: number;
	avgRating: number | null;
}

/** Count and average rating per quadrant, in a fixed reading order (loved quadrants first). */
export function quadrantSummaries(points: QuadrantPoint[]): QuadrantSummary[] {
	const order: Quadrant[] = [
		'popular-loved',
		'obscure-loved',
		'popular-disliked',
		'obscure-disliked'
	];
	return order.map((quadrant) => {
		const group = points.filter((p) => p.quadrant === quadrant);
		const avgRating =
			group.length === 0 ? null : group.reduce((sum, p) => sum + p.rating, 0) / group.length;
		return { quadrant, label: QUADRANT_LABELS[quadrant], count: group.length, avgRating };
	});
}

/** Obscure films you rated highest, least-seen first among ties: the hidden-gems callout. */
export function hiddenGems(points: QuadrantPoint[], limit = 10): QuadrantPoint[] {
	return points
		.filter((p) => p.quadrant === 'obscure-loved')
		.sort((a, b) => b.rating - a.rating || a.popularity - b.popularity)
		.slice(0, limit);
}
