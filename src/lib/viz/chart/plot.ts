import { hashString } from '$lib/random';

/** Room around the plot for the y tick labels, the x tick labels and the x axis label. */
export const MARGIN = { top: 12, right: 12, bottom: 34, left: 40 };

/** The plot area inside MARGIN for a chart of this size. */
export function plotArea(width: number, height: number): { w: number; h: number } {
	return {
		w: Math.max(1, width - MARGIN.left - MARGIN.right),
		h: Math.max(1, height - MARGIN.top - MARGIN.bottom)
	};
}

/** The first candidate step that keeps an axis under ten ticks, else the largest. */
export function niceStep(span: number, steps: number[]): number {
	return steps.find((step) => span / step <= 9) ?? steps[steps.length - 1];
}

/** Min and max as a loop, not Math.max(...values): a large library would overflow the argument list. */
export function extent(values: Iterable<number>): { min: number; max: number } | null {
	let min = Infinity;
	let max = -Infinity;
	for (const v of values) {
		if (v < min) min = v;
		if (v > max) max = v;
	}
	return min === Infinity ? null : { min, max };
}

/** A star-rating y axis with headroom for jittered points at 0.5 and 5. */
export const STAR_AXIS = { min: 0.25, max: 5.25, ticks: [1, 2, 3, 4, 5] };

const JITTER = 0.18;

/**
 * A stable offset in rating units hashed from the URI, so ten discrete rating steps don't stack
 * into ten flat stripes and a point never jumps between renders.
 */
export function ratingJitter(uri: string): number {
	return ((hashString(uri) >>> 0) / 0xffffffff) * 2 * JITTER - JITTER;
}
