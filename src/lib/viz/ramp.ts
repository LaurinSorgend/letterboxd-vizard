import { quantile } from '$lib/math';

/*
 * The binned colour scales every chart shares. Colours live in app.css as --map-bin-0…9 (Viridis,
 * for ratings, counts and watchtime) and --degree-bin-0…9 (Plasma, for network hops); this module
 * owns how many bins there are, how a value falls into one, and what the legend says.
 */

export const BIN_COUNT = 10;

export type Ramp = 'map' | 'degree';

/** The CSS colour of bin `bin` on `ramp`. */
export const binColor = (bin: number, ramp: Ramp = 'map'): string => `var(--${ramp}-bin-${bin})`;

/**
 * Bins from this one up are light enough to need dark text on top: the yellow-green end of the
 * Viridis ramp, whose colours are the same in every theme.
 */
export const FIRST_LIGHT_BIN = 6;

/** One bin per half-star, matching Letterboxd's own rating granularity exactly. */
export const HALF_STAR_THRESHOLDS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** For a single film's exact rating (always a half-star value itself). */
export const HALF_STAR_LABELS = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];

/** The rating scale's real endpoints, for the ends of a legend. */
export const RATING_RANGE = { min: '0.5', max: '5' };

/**
 * For a continuous average (world map, heatmaps): each bin is a range, since an average can land
 * anywhere between half-stars, not just on one. 0.5 is the floor (no film rates below it) and 5
 * the ceiling, so unlike `countBinLabels` neither end is left open.
 */
export const HALF_STAR_RANGE_LABELS = (() => {
	const bounds = [0.5, ...HALF_STAR_THRESHOLDS];
	return bounds.map((lo, i) => {
		if (i === HALF_STAR_THRESHOLDS.length) return `${lo}`;
		const hi = bounds[i + 1] - 0.1;
		return `${lo}–${hi.toFixed(1)}`;
	});
})();

/** Geometric thresholds between 2 and max, one fewer than there are bins. */
export function countThresholds(max: number): number[] {
	const cuts = BIN_COUNT - 1;
	if (max <= BIN_COUNT) return Array.from({ length: cuts }, (_, i) => i + 2);
	const thresholds: number[] = [];
	for (let i = 1; i <= cuts; i++) {
		let t = Math.round(max ** (i / BIN_COUNT));
		while (thresholds.includes(t) || t < 2) t += 1;
		thresholds.push(t);
	}
	return thresholds;
}

export function countBinLabels(thresholds: number[]): string[] {
	const bounds = [1, ...thresholds];
	return bounds.map((lo, i) => {
		const hi = i < thresholds.length ? bounds[i + 1] - 1 : null;
		if (hi === null) return `${lo}+`;
		return hi === lo ? `${lo}` : `${lo}–${hi}`;
	});
}

/** Even quantile cuts of the positive values, one fewer than there are bins; [] when none. */
export function quantileCuts(values: number[]): number[] {
	const measured = values.filter((v) => v > 0);
	if (measured.length === 0) return [];
	return Array.from({ length: BIN_COUNT - 1 }, (_, i) => quantile(measured, (i + 1) / BIN_COUNT)!);
}

/** Bin index 0..thresholds.length for a value (bin i = value >= thresholds[i-1]). */
export function binIndex(value: number, thresholds: number[]): number {
	return thresholds.filter((t) => value >= t).length;
}

/** The bin of a value that may be unknown: 'few' when nothing behind it was rated. */
export const binOf = (value: number | null, thresholds: number[]): number | 'few' =>
	value === null ? 'few' : binIndex(value, thresholds);

/** A 0..1 share onto the ramp, the top end included in the last bin. */
export const shareBin = (share: number): number =>
	Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(share * BIN_COUNT)));
