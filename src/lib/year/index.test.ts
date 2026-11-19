import { describe, expect, it } from 'vitest';
import { film, watched } from '$lib/testing/fixtures';
import { buildYear, deckYear, MIN_FILMS, recapYears } from './index';

const logged = (count: number, date = '2025-03-01') =>
	Array.from({ length: count }, () => film(watched([date])));

describe('buildYear', () => {
	it('describes a year with enough films and names its verdict', () => {
		const year = buildYear(logged(MIN_FILMS), 2025);
		expect(year?.library.slice).toHaveLength(MIN_FILMS);
		expect(year?.personality.title).toBeTruthy();
	});

	it('returns null for a year under the floor', () => {
		expect(buildYear(logged(MIN_FILMS - 1), 2025)).toBeNull();
	});
});

describe('recapYears and deckYear', () => {
	const films = [...logged(MIN_FILMS, '2024-05-01'), ...logged(MIN_FILMS, '2025-05-01')];
	const november = new Date('2025-11-15T12:00:00Z');
	const december = new Date('2025-12-15T12:00:00Z');

	it('holds the running year back until December, in both surfaces', () => {
		expect(recapYears(films, november)).toEqual([2024]);
		expect(deckYear(films, november)).toBeNull();
		expect(recapYears(films, december)).toEqual([2025, 2024]);
		expect(deckYear(films, december)).toBe(2025);
	});

	it('skips a year under the floor', () => {
		expect(recapYears([...films, ...logged(MIN_FILMS - 1, '2023-05-01')], december)).toEqual([
			2025, 2024
		]);
	});

	it('plays the latest finished year in demo mode in any month', () => {
		expect(deckYear(films, november, { demo: true })).toBe(2024);
	});
});
