import { describe, expect, it } from 'vitest';
import {
	BIN_COUNT,
	binOf,
	countBinLabels,
	countThresholds,
	HALF_STAR_LABELS,
	HALF_STAR_RANGE_LABELS,
	HALF_STAR_THRESHOLDS,
	quantileCuts,
	shareBin
} from './ramp';

describe('ramp bins', () => {
	it('gives every scale one label per bin', () => {
		expect(HALF_STAR_LABELS).toHaveLength(BIN_COUNT);
		expect(HALF_STAR_RANGE_LABELS).toHaveLength(BIN_COUNT);
		expect(countBinLabels(countThresholds(500))).toHaveLength(BIN_COUNT);
		expect(HALF_STAR_THRESHOLDS).toHaveLength(BIN_COUNT - 1);
	});

	it('puts each half-star rating in its own bin', () => {
		const bins = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) =>
			binOf(r, HALF_STAR_THRESHOLDS)
		);
		expect(bins).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('marks a value with nothing rated behind it as few', () => {
		expect(binOf(null, HALF_STAR_THRESHOLDS)).toBe('few');
	});

	it('keeps count thresholds rising and labels them as ranges', () => {
		const thresholds = countThresholds(1000);
		expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
		expect(new Set(thresholds).size).toBe(thresholds.length);
		expect(countBinLabels([2, 3, 5])).toEqual(['1', '2', '3–4', '5+']);
	});

	it('cuts positive values into even quantiles and ignores empty periods', () => {
		const values = [0, 0, ...Array.from({ length: 100 }, (_, i) => i + 1)];
		const cuts = quantileCuts(values);
		expect(cuts).toHaveLength(BIN_COUNT - 1);
		expect(cuts[4]).toBe(51);
		expect(quantileCuts([0, 0])).toEqual([]);
	});

	it('maps a 0..1 share onto the ramp, the top included', () => {
		expect(shareBin(0)).toBe(0);
		expect(shareBin(0.55)).toBe(5);
		expect(shareBin(1)).toBe(BIN_COUNT - 1);
		expect(shareBin(-0.2)).toBe(0);
	});
});
