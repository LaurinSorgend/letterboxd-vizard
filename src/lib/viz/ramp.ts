/**
 * Sequential 5-step Viridis samples per theme (DESIGN.md data-scale exception).
 * Light: t 0.65→0.05 (more = darker); dark: t 0.30→0.95 (more = lighter).
 * Monotone lightness, step gaps, and surface contrast validated with the
 * dataviz palette checker (--ordinal). Index 0 = lowest bin.
 */
export const RAMP_LIGHT = ['#2fb47c', '#21918c', '#2f6c8e', '#414487', '#471365'];
export const RAMP_DARK = ['#355f8d', '#24868e', '#26ad81', '#6ece58', '#dfe318'];
export const BIN_COUNT = 5;

export const RATING_THRESHOLDS = [3, 3.5, 4, 4.5];

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

export function ratingBinLabels(): string[] {
	return ['< 3', '3–3.4', '3.5–3.9', '4–4.4', '4.5+'];
}
