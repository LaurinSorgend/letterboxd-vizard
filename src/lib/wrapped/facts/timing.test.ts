import { describe, expect, it } from 'vitest';
import { film, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '../library';
import { bestWeek, doubleBills, longestGap, weekdays } from './timing';

function libraryOf(dates: string[][]) {
	return buildLibrary({
		films: dates.map((set) => film(watched(set))),
		year: 2025,
		now: new Date('2026-01-15T00:00:00Z')
	});
}

describe('longestGap', () => {
	it('finds the widest silence between two entries', () => {
		const gap = longestGap(libraryOf([['2025-01-05'], ['2025-07-03'], ['2025-08-06']]));
		expect(gap).toMatchObject({ days: 179, from: '2025-01-05', to: '2025-07-03', kind: 'between' });
		expect(gap?.second).toBe(147);
	});

	it('counts the run from 1 January as a late start', () => {
		const gap = longestGap(
			libraryOf([
				['2025-02-14'],
				['2025-03-20'],
				['2025-05-01'],
				['2025-06-10'],
				['2025-07-20'],
				['2025-08-30'],
				['2025-10-10'],
				['2025-11-20'],
				['2025-12-25']
			])
		);
		expect(gap).toMatchObject({ days: 44, to: '2025-02-14', kind: 'late-start' });
		expect(gap?.second).toBe(42);
	});

	it('closes a finished year at 31 December', () => {
		const gap = longestGap(libraryOf([['2025-01-01'], ['2025-01-02']]));
		expect(gap).toMatchObject({ days: 363, from: '2025-01-02', kind: 'early-stop' });
	});

	it('returns null for an empty year', () => {
		expect(longestGap(libraryOf([]))).toBeNull();
	});
});

describe('weekdays', () => {
	it('tallies Monday first and reports the weekend share', () => {
		// 2025-01-06 is a Monday, 2025-01-11 a Saturday, 2025-01-12 a Sunday.
		const result = weekdays(libraryOf([['2025-01-06', '2025-01-11'], ['2025-01-12']]));
		expect(result?.counts).toEqual([1, 0, 0, 0, 0, 1, 1]);
		expect(result?.best).toBe(0);
		expect(result?.weekendShare).toBeCloseTo(2 / 3);
	});
});

describe('doubleBills', () => {
	it('counts the days carrying more than one entry', () => {
		const result = doubleBills(
			libraryOf([
				['2025-01-01', '2025-02-02'],
				['2025-01-01', '2025-02-02'],
				['2025-02-02'],
				['2025-03-03']
			])
		);
		expect(result).toMatchObject({
			days: 2,
			triples: 1,
			heaviest: { date: '2025-02-02', count: 3 }
		});
		expect(result?.share).toBeCloseTo(5 / 6);
	});

	it('reports no heaviest day when nothing reached three', () => {
		const result = doubleBills(libraryOf([['2025-01-01'], ['2025-01-01'], ['2025-02-02']]));
		expect(result?.heaviest).toBeNull();
	});
});

describe('bestWeek', () => {
	it('takes the heaviest rolling seven days and a non-overlapping runner-up', () => {
		const result = bestWeek(
			libraryOf([['2025-05-01'], ['2025-05-02'], ['2025-05-03'], ['2025-09-10'], ['2025-09-11']])
		);
		expect(result).toMatchObject({ count: 3, start: '2025-05-01', end: '2025-05-07' });
		expect(result?.films).toHaveLength(3);
		expect(result?.runnerUp).toBe(2);
	});
});
