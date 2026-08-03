/* Bin colors live in app.css (--map-bin-0…4); this module owns thresholds and labels. */

/** One bin per half-star, matching Letterboxd's own rating granularity exactly. */
export const HALF_STAR_THRESHOLDS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** For a single film's exact rating (always a half-star value itself). */
export const HALF_STAR_LABELS = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];

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

/** Nine geometric thresholds between 2 and max, giving 10 count bins. */
export function countThresholds(max: number): number[] {
	if (max <= 10) return Array.from({ length: 9 }, (_, i) => i + 2);
	const thresholds: number[] = [];
	for (let i = 1; i <= 9; i++) {
		let t = Math.round(max ** (i / 10));
		while (thresholds.includes(t) || t < 2) t += 1;
		thresholds.push(t);
	}
	return thresholds;
}

/** Bin index 0..thresholds.length for a value (bin i = value >= thresholds[i-1]). */
export function binIndex(value: number, thresholds: number[]): number {
	return thresholds.filter((t) => value >= t).length;
}

export function countBinLabels(thresholds: number[]): string[] {
	const bounds = [1, ...thresholds];
	return bounds.map((lo, i) => {
		const hi = i < thresholds.length ? bounds[i + 1] - 1 : null;
		if (hi === null) return `${lo}+`;
		return hi === lo ? `${lo}` : `${lo}–${hi}`;
	});
}
