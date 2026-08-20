import { describe, expect, it } from 'vitest';
import { longDate } from './dates';

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
