import { describe, expect, it } from 'vitest';
import { datePair, fullDate, longDate } from './dates';

describe('longDate', () => {
	it('leaves the year off a date inside the year being recapped', () => {
		expect(longDate('2025-04-12', 2025)).toBe('12 April');
	});

	it('adds the year when the date falls outside it', () => {
		expect(longDate('2021-04-12', 2025)).toBe('12 April 2021');
	});

	it('adds the year for a date in the year after', () => {
		expect(longDate('2026-01-03', 2025)).toBe('3 January 2026');
	});

	it('reads the day first, so 03-07 is July', () => {
		expect(longDate('2025-07-03', 2025)).toBe('3 July');
	});
});

describe('datePair', () => {
	it('leaves the year off both ends of a range inside the year', () => {
		expect(datePair('2025-01-02', '2025-01-08', 2025)).toEqual(['2 January', '8 January']);
	});

	it('dates both ends when the range crosses New Year, not just the one outside', () => {
		expect(datePair('2025-12-28', '2026-01-03', 2025)).toEqual([
			'28 December 2025',
			'3 January 2026'
		]);
	});
});

describe('fullDate', () => {
	it('always carries the year, whatever is being recapped', () => {
		expect(fullDate('2025-12-17')).toBe('17 December 2025');
	});
});
