import { percent } from '$lib/format';
import { BARS } from './bars';
import type { Rule } from './rules';

/** Three years inside a tenth of each other, all substantial: a habit rather than a year. */
function steady(years: number[]): boolean {
	if (years.length < 3) return false;
	if (years.some((count) => count < 25)) return false;
	const high = Math.max(...years);
	const low = Math.min(...years);
	return high - low <= high * 0.1;
}

export const RHYTHM: Rule[] = [
	{
		id: 'projectionist',
		title: 'The Projectionist',
		when: (t) => t.films >= 360,
		detail: (t) =>
			`${t.films} films across the year, an average of ${(t.films / 52).toFixed(1)} a week.`
	},
	{
		id: 'sampler',
		title: 'The Sampler',
		when: (t) => t.films >= 10 && t.films <= 15 && Math.max(...t.monthCounts) <= 2,
		detail: (t) => `${t.films} films across the year, and no month with more than two.`
	},
	{
		id: 'ritualist',
		title: 'The Ritualist',
		when: (t) => t.films <= 30 && t.activeMonths >= 10,
		detail: (t) =>
			`${t.films} films, and something logged in ${t.activeMonths} of the twelve months.`
	},
	{
		id: 'sprinter',
		title: 'The Sprinter',
		when: (t) => t.sprintShare >= 0.4 && t.entries >= 25,
		detail: (t) =>
			`${Math.round(t.sprintShare * t.entries)} of your ${t.entries} entries landed on days when you watched three or more.`
	},
	{
		id: 'weekender',
		title: 'The Weekender',
		when: (t) => t.weekendShare >= BARS.weekender && t.entries >= 25,
		detail: (t) => `${percent(t.weekendShare)} of your entries were Saturdays and Sundays.`
	},
	{
		id: 'crammer',
		title: 'The Crammer',
		when: (t) => t.decemberShare >= BARS.crammer && t.films >= 25,
		detail: (t) =>
			`${Math.round(t.decemberShare * t.entries)} of your ${t.entries} entries were logged in December.`
	},
	{
		id: 'lapsed',
		title: 'The Lapsed',
		when: (t) => t.firstQuarterShare >= 0.55 && t.lastThirdShare < 0.1 && t.films >= 25,
		detail: (t) =>
			`${Math.round(t.firstQuarterShare * t.entries)} entries by the end of March. ${Math.round(t.lastThirdShare * t.entries)} from September on.`
	},
	{
		id: 'hibernator',
		title: 'The Hibernator',
		when: (t) => t.longestGapDays >= 90 && t.films >= 30,
		detail: (t) => `${t.longestGapDays} days with nothing logged, and ${t.films} films around it.`
	},
	{
		id: 'prodigal',
		title: 'The Prodigal',
		when: (t) => t.previousYearFilms === 0 && t.films >= 20 && t.loggedBeforePreviousYear,
		detail: (t) => `Nothing logged in ${t.year - 1}. ${t.films} films in ${t.year}.`
	},
	{
		id: 'fixture',
		title: 'The Fixture',
		when: (t) => steady(t.recentYears),
		detail: (t) =>
			`${t.recentYears[0]} films. ${t.recentYears[1]} the year before, ${t.recentYears[2]} the year before that.`
	}
];
