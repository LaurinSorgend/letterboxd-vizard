import { describe, expect, it } from 'vitest';
import { neutralTraits } from './test-traits';
import { RHYTHM } from './rhythm';
import { ORDER, rulesInOrder } from './rules';

const rule = (id: string) => RHYTHM.find((entry) => entry.id === id)!;

const IDS = [
	'projectionist',
	'sampler',
	'ritualist',
	'sprinter',
	'weekender',
	'crammer',
	'lapsed',
	'hibernator',
	'prodigal',
	'fixture'
];

describe('RHYTHM', () => {
	it('exports the ten labels and wires them into the evaluation order', () => {
		expect(RHYTHM.map((entry) => entry.id)).toEqual(IDS);
		const ordered = rulesInOrder().map((entry) => entry.id);
		for (const id of IDS) {
			expect(ORDER).toContain(id);
			expect(ordered).toContain(id);
		}
	});

	it('leaves a middling year unlabelled across the whole registry, not just this section', () => {
		const fired = rulesInOrder()
			.filter((entry) => entry.when(neutralTraits()))
			.map((entry) => entry.id);
		expect(fired).toEqual(['regular']);
	});
});

describe('The Projectionist', () => {
	it('fires from 360 films and not below', () => {
		expect(rule('projectionist').when(neutralTraits({ films: 360 }))).toBe(true);
		expect(rule('projectionist').when(neutralTraits({ films: 359 }))).toBe(false);
	});

	it('cites a weekly average that stays true at both ends of its range', () => {
		expect(rule('projectionist').detail(neutralTraits({ films: 360, entries: 372 }))).toBe(
			'360 films across the year, an average of 6.9 a week.'
		);
		expect(rule('projectionist').detail(neutralTraits({ films: 730, entries: 744 }))).toBe(
			'730 films across the year, an average of 14.0 a week.'
		);
	});
});

describe('The Sampler', () => {
	const small = {
		films: 12,
		entries: 12,
		activeMonths: 8,
		monthCounts: [2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0],
		recentYears: [12, 30, 26]
	};

	it('needs a small year with no month above two', () => {
		expect(rule('sampler').when(neutralTraits(small))).toBe(true);
	});

	it('stops one film either side of the band', () => {
		expect(
			rule('sampler').when(
				neutralTraits({
					...small,
					films: 15,
					entries: 15,
					activeMonths: 9,
					monthCounts: [2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0]
				})
			)
		).toBe(true);
		expect(
			rule('sampler').when(
				neutralTraits({
					...small,
					films: 16,
					entries: 16,
					activeMonths: 9,
					monthCounts: [2, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0]
				})
			)
		).toBe(false);
		expect(
			rule('sampler').when(
				neutralTraits({
					...small,
					films: 10,
					entries: 10,
					activeMonths: 6,
					monthCounts: [2, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0]
				})
			)
		).toBe(true);
		expect(
			rule('sampler').when(
				neutralTraits({
					...small,
					films: 9,
					entries: 9,
					activeMonths: 6,
					monthCounts: [2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0]
				})
			)
		).toBe(false);
	});

	it('stops when one month carries three', () => {
		expect(
			rule('sampler').when(
				neutralTraits({
					...small,
					activeMonths: 7,
					monthCounts: [3, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0]
				})
			)
		).toBe(false);
	});

	it('cites the count and the ceiling', () => {
		expect(rule('sampler').detail(neutralTraits(small))).toBe(
			'12 films across the year, and no month with more than two.'
		);
	});
});

describe('The Ritualist', () => {
	const habit = {
		films: 24,
		entries: 24,
		activeMonths: 10,
		monthCounts: [3, 3, 3, 2, 2, 2, 2, 2, 2, 3, 0, 0],
		recentYears: [24, 30, 26]
	};

	it('needs ten active months in a small year', () => {
		expect(rule('ritualist').when(neutralTraits(habit))).toBe(true);
		expect(rule('ritualist').when(neutralTraits({ ...habit, films: 30 }))).toBe(true);
		expect(rule('ritualist').when(neutralTraits({ ...habit, films: 31 }))).toBe(false);
		expect(rule('ritualist').when(neutralTraits({ ...habit, activeMonths: 9 }))).toBe(false);
	});

	it('cites the count and the months', () => {
		expect(rule('ritualist').detail(neutralTraits(habit))).toBe(
			'24 films, and something logged in 10 of the twelve months.'
		);
	});
});

describe('The Sprinter', () => {
	it('needs two fifths of the entries on doubled-up days', () => {
		expect(rule('sprinter').when(neutralTraits({ sprintShare: 0.4 }))).toBe(true);
		expect(rule('sprinter').when(neutralTraits({ sprintShare: 0.39 }))).toBe(false);
		expect(rule('sprinter').when(neutralTraits({ sprintShare: 0.4, entries: 25 }))).toBe(true);
		expect(rule('sprinter').when(neutralTraits({ sprintShare: 0.4, entries: 24 }))).toBe(false);
	});

	it('cites the entries, not the days, and the threshold they were counted at', () => {
		expect(rule('sprinter').detail(neutralTraits({ sprintShare: 0.5 }))).toBe(
			'20 of your 40 entries landed on days when you watched three or more.'
		);
	});
});

describe('The Weekender', () => {
	it('needs a weekend share and enough entries', () => {
		expect(rule('weekender').when(neutralTraits({ weekendShare: 0.6 }))).toBe(true);
		expect(rule('weekender').when(neutralTraits({ weekendShare: 0.59 }))).toBe(false);
		expect(rule('weekender').when(neutralTraits({ weekendShare: 0.6, entries: 25 }))).toBe(true);
		expect(rule('weekender').when(neutralTraits({ weekendShare: 0.6, entries: 24 }))).toBe(false);
	});

	it('cites the share', () => {
		expect(rule('weekender').detail(neutralTraits({ weekendShare: 0.62 }))).toBe(
			'62% of your entries were Saturdays and Sundays.'
		);
	});
});

describe('The Crammer', () => {
	it('needs a heavy December in a year worth cramming', () => {
		expect(rule('crammer').when(neutralTraits({ decemberShare: 0.3 }))).toBe(true);
		expect(rule('crammer').when(neutralTraits({ decemberShare: 0.29 }))).toBe(false);
		expect(rule('crammer').when(neutralTraits({ decemberShare: 0.3, films: 25 }))).toBe(true);
		expect(rule('crammer').when(neutralTraits({ decemberShare: 0.3, films: 24 }))).toBe(false);
	});

	it('cites the December entries out of the year', () => {
		const december = neutralTraits({
			decemberShare: 0.35,
			activeMonths: 11,
			monthCounts: [4, 4, 4, 3, 3, 2, 2, 2, 1, 1, 0, 14]
		});
		expect(rule('crammer').detail(december)).toBe('14 of your 40 entries were logged in December.');
	});
});

describe('The Lapsed', () => {
	const early = { firstQuarterShare: 0.55, lastThirdShare: 0.05 };

	it('needs a front-loaded year that then stopped', () => {
		expect(rule('lapsed').when(neutralTraits(early))).toBe(true);
		expect(rule('lapsed').when(neutralTraits({ ...early, firstQuarterShare: 0.54 }))).toBe(false);
		expect(rule('lapsed').when(neutralTraits({ ...early, lastThirdShare: 0.09 }))).toBe(true);
		expect(rule('lapsed').when(neutralTraits({ ...early, lastThirdShare: 0.1 }))).toBe(false);
		expect(rule('lapsed').when(neutralTraits({ ...early, films: 25 }))).toBe(true);
		expect(rule('lapsed').when(neutralTraits({ ...early, films: 24 }))).toBe(false);
	});

	it('cites both ends of the year', () => {
		const stopped = neutralTraits({
			firstQuarterShare: 0.6,
			lastThirdShare: 0.05,
			monthCounts: [8, 8, 8, 3, 3, 3, 3, 2, 1, 1, 0, 0]
		});
		expect(rule('lapsed').detail(stopped)).toBe(
			'24 entries by the end of March. 2 from September on.'
		);
	});
});

describe('The Hibernator', () => {
	it('needs a season off inside a year with weight', () => {
		expect(rule('hibernator').when(neutralTraits({ longestGapDays: 90 }))).toBe(true);
		expect(rule('hibernator').when(neutralTraits({ longestGapDays: 89 }))).toBe(false);
		expect(rule('hibernator').when(neutralTraits({ longestGapDays: 90, films: 30 }))).toBe(true);
		expect(rule('hibernator').when(neutralTraits({ longestGapDays: 90, films: 29 }))).toBe(false);
	});

	it('cites the gap and the year around it', () => {
		expect(rule('hibernator').detail(neutralTraits({ longestGapDays: 97 }))).toBe(
			'97 days with nothing logged, and 36 films around it.'
		);
	});
});

describe('The Prodigal', () => {
	const back = {
		films: 20,
		entries: 22,
		previousYearFilms: 0,
		recentYears: [20, 0, 26],
		loggedBeforePreviousYear: true
	};

	it('needs a blank year behind a real one, with history before that', () => {
		expect(rule('prodigal').when(neutralTraits(back))).toBe(true);
		expect(rule('prodigal').when(neutralTraits({ ...back, films: 19 }))).toBe(false);
		expect(
			rule('prodigal').when(
				neutralTraits({ ...back, previousYearFilms: 1, recentYears: [20, 1, 26] })
			)
		).toBe(false);
		expect(rule('prodigal').when(neutralTraits({ ...back, loggedBeforePreviousYear: false }))).toBe(
			false
		);
	});

	it('names both years', () => {
		expect(
			rule('prodigal').detail(
				neutralTraits({ ...back, films: 61, entries: 65, recentYears: [61, 0, 26] })
			)
		).toBe('Nothing logged in 2024. 61 films in 2025.');
	});
});

describe('The Fixture', () => {
	const level = (years: number[]) =>
		neutralTraits({ films: years[0], entries: years[0], recentYears: years });

	it('needs three years within a tenth of the highest', () => {
		expect(rule('fixture').when(level([128, 124, 131]))).toBe(true);
		expect(rule('fixture').when(level([128, 124, 60]))).toBe(false);
		expect(rule('fixture').when(level([100, 100, 90]))).toBe(true);
		expect(rule('fixture').when(level([100, 100, 89]))).toBe(false);
	});

	it('needs all three years to be substantial', () => {
		expect(rule('fixture').when(level([25, 25, 25]))).toBe(true);
		expect(rule('fixture').when(level([25, 25, 24]))).toBe(false);
	});

	it('refuses a history shorter than three years', () => {
		expect(rule('fixture').when(level([100, 100]))).toBe(false);
		expect(rule('fixture').when(level([100]))).toBe(false);
		expect(rule('fixture').when(neutralTraits({ recentYears: [] }))).toBe(false);
	});

	it('cites all three years in order', () => {
		expect(rule('fixture').detail(level([128, 124, 131]))).toBe(
			'128 films. 124 the year before, 131 the year before that.'
		);
	});
});
