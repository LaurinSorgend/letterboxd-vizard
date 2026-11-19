export const DAY_MS = 24 * 60 * 60 * 1000;

/** Nearest-rank quantile: `fraction: 0.5` is the upper middle on an even count. */
export function quantile(values: number[], fraction: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

/**
 * Middle value by nearest rank. Every median shown alongside another uses this one
 * convention, so the figures stay comparable.
 */
export function median(values: number[]): number | null {
	return quantile(values, 0.5);
}

/**
 * Middle value, averaging the two middle values on an even count. The popularity quadrants split
 * on this rather than `median`, so exactly half the films fall on each side of a split the readout
 * quotes; it is not compared with any other median.
 */
export function meanMedian(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface LinearFit {
	slope: number;
	intercept: number;
	/** Pearson correlation, −1 to 1. */
	r: number;
}

/** Least-squares line of `ys` on `xs`; null with fewer than two points or no spread on either axis. */
export function linearFit(xs: number[], ys: number[]): LinearFit | null {
	const n = xs.length;
	if (n < 2) return null;
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
	const slope = sxy / sxx;
	return { slope, intercept: meanY - slope * meanX, r: sxy / Math.sqrt(sxx * syy) };
}

export function pearson(xs: number[], ys: number[]): number | null {
	return linearFit(xs, ys)?.r ?? null;
}

export interface Streak {
	days: number;
	start: string;
	end: string;
}

/** The longest run of consecutive calendar days in a set of ISO dates, or null if empty. */
export function longestRun(dates: string[]): Streak | null {
	const days = [...new Set(dates)].sort();
	if (days.length === 0) return null;
	let best: Streak = { days: 1, start: days[0], end: days[0] };
	let run = 1;
	for (let i = 1; i < days.length; i++) {
		run = (Date.parse(days[i]) - Date.parse(days[i - 1])) / DAY_MS === 1 ? run + 1 : 1;
		if (run > best.days) best = { days: run, start: days[i - run + 1], end: days[i] };
	}
	return best;
}
