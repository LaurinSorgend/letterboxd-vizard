import { describe, expect, it } from 'vitest';
import { shiftDays, yearOf } from './dates';

describe('shiftDays', () => {
	it('steps across month, year and leap-day boundaries', () => {
		expect(shiftDays('2026-01-31', 1)).toBe('2026-02-01');
		expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(shiftDays('2024-02-28', 1)).toBe('2024-02-29');
		expect(shiftDays('2025-02-28', 1)).toBe('2025-03-01');
		expect(shiftDays('2026-11-14', -730)).toBe('2024-11-14');
		expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31');
	});
});

describe('yearOf', () => {
	it('reads the year from a TMDB date or a bare year, and null from nothing', () => {
		expect(yearOf('2019-05-30')).toBe(2019);
		expect(yearOf('2019')).toBe(2019);
		expect(yearOf('')).toBeNull();
		expect(yearOf(undefined)).toBeNull();
	});
});
