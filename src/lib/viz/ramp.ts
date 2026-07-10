/* Bin colors live in app.css (--map-bin-0…4); this module owns thresholds and labels. */

export const RATING_THRESHOLDS = [3, 3.5, 4, 4.5];
export const RATING_BIN_LABELS = ['< 3', '3–3.4', '3.5–3.9', '4–4.4', '4.5+'];

/** Four geometric thresholds between 2 and max, giving 5 count bins. */
export function countThresholds(max: number): number[] {
	if (max <= 5) return [2, 3, 4, 5];
	const thresholds: number[] = [];
	for (let i = 1; i <= 4; i++) {
		let t = Math.round(max ** (i / 5));
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
