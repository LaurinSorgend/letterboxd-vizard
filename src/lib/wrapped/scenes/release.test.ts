import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from '../wrapped';
import { freshnessScene, longestWaitScene, shelfScene } from './release';

const archive = Array.from({ length: 22 }, (_, i) =>
	film({
		...watched([`2025-0${(i % 9) + 1}-15`]),
		rating: 4,
		tmdb: tmdb({ releaseDate: i < 5 ? '2025-02-01' : '1979-05-13', year: i < 5 ? 2025 : 1979 })
	})
);
const brutalist = film({
	name: 'The Brutalist',
	...watched(['2025-01-27']),
	tmdb: tmdb({ releaseDate: '2025-01-24', year: 2025 })
});
const openingDay = film({
	name: 'Premiere Night',
	...watched(['2025-05-05']),
	tmdb: tmdb({ releaseDate: '2025-05-05', year: 2025 })
});

/** A ten-year wait, well clear of the five-year floor but nowhere near twenty. */
const decadeWaiters = Array.from({ length: 10 }, (_, i) =>
	film({
		name: i === 0 ? 'Patience' : `Decade Waiter ${i}`,
		...watched(['2025-06-10']),
		rating: 3,
		tmdb: tmdb({ releaseDate: '2015-06-10', year: 2015 })
	})
);

/** A two-year wait, under the five-year floor `longestWait` requires. */
const shortWaiters = Array.from({ length: 10 }, () =>
	film({
		...watched(['2025-06-10']),
		rating: 3,
		tmdb: tmdb({ releaseDate: '2023-06-10', year: 2023 })
	})
);

describe('longestWaitScene', () => {
	it('leads on the number of years and shows the poster', () => {
		const scene = longestWaitScene(buildWrapped(archive, 2025)!);
		expect(scene).toMatchObject({ id: 'wait', valueKind: 'number', value: '46' });
		expect(scene?.body.kind).toBe('posters');
		expect(scene?.note).toContain('1979');
		expect(scene?.note).toBe(
			'Film 18 came out in 1979. You watched it on 15 September, 46 years later. 16 other films waited more than twenty years for you.'
		);
	});

	it('omits the twenty-year sentence when nothing crossed that mark', () => {
		const scene = longestWaitScene(buildWrapped(decadeWaiters, 2025)!);
		expect(scene?.value).toBe('10');
		expect(scene?.note).toBe(
			'Patience came out in 2015. You watched it on 10 June, 10 years later.'
		);
	});

	it('drops out when nothing waited five years', () => {
		expect(longestWaitScene(buildWrapped(shortWaiters, 2025)!)).toBeNull();
	});
});

/** 20 dated films (5 current-year) plus 2 films with no TMDB release date at all. */
const withUndated = [
	...Array.from({ length: 20 }, (_, i) =>
		film({
			...watched([`2025-10-${String((i % 28) + 1).padStart(2, '0')}`]),
			rating: 4,
			tmdb: tmdb({ releaseDate: i < 5 ? '2025-03-01' : '1994-03-01', year: i < 5 ? 2025 : 1994 })
		})
	),
	...Array.from({ length: 2 }, () =>
		film({ ...watched(['2025-11-01']), tmdb: tmdb({ releaseDate: null, year: null }) })
	)
];

/** 10 dated films (5 current-year): under the twenty-dated floor, well past the three-current one. */
const thinButFresh = Array.from({ length: 10 }, (_, i) =>
	film({
		...watched([`2025-12-${String((i % 28) + 1).padStart(2, '0')}`]),
		rating: 4,
		tmdb: tmdb({ releaseDate: i < 5 ? '2025-03-01' : '1994-03-01', year: i < 5 ? 2025 : 1994 })
	})
);

/** 20 dated films (2 current-year): past the twenty-dated floor, under the three-current one. */
const plentyButStale = Array.from({ length: 20 }, (_, i) =>
	film({
		...watched([`2025-04-${String((i % 28) + 1).padStart(2, '0')}`]),
		rating: 4,
		tmdb: tmdb({ releaseDate: i < 2 ? '2025-03-01' : '1994-03-01', year: i < 2 ? 2025 : 1994 })
	})
);

describe('freshnessScene', () => {
	it('reports the share of the year that was new', () => {
		const scene = freshnessScene(buildWrapped(archive, 2025)!);
		expect(scene).toMatchObject({ id: 'new-releases', value: '23%' });
		expect(scene?.body.kind).toBe('posters');
	});

	it('shares against every film watched, not just the dated ones', () => {
		const scene = freshnessScene(buildWrapped(withUndated, 2025)!);
		// 5 current-year of 22 films watched (20 dated + 2 undated) = 22.7%, rounds to 23%.
		expect(scene).toMatchObject({ value: '23%' });
		expect(scene?.note).toBe(
			'5 of your 22 films came out in 2025. The rest of the year you spent in the archive.'
		);
	});

	it('drops out under twenty dated films even with enough current-year ones', () => {
		expect(freshnessScene(buildWrapped(thinButFresh, 2025)!)).toBeNull();
	});

	it('drops out under three current-year films even with enough dated ones', () => {
		expect(freshnessScene(buildWrapped(plentyButStale, 2025)!)).toBeNull();
	});
});

describe('shelfScene', () => {
	it('names the film that reached the viewer fastest', () => {
		const scene = shelfScene(buildWrapped([...archive, brutalist], 2025)!);
		expect(scene).toMatchObject({ id: 'shelf', value: '3' });
		expect(scene?.note).toBe(
			'You watched The Brutalist 3 days after it opened. Only 1 other release reached you inside a month.'
		);
	});

	it('drops the extra sentence when nothing else arrived inside a month', () => {
		const scene = shelfScene(buildWrapped([...archive.slice(5), brutalist], 2025)!);
		expect(scene?.value).toBe('3');
		expect(scene?.note).toBe('You watched The Brutalist 3 days after it opened.');
	});

	it('drops out when nothing arrived inside a month', () => {
		expect(shelfScene(buildWrapped(archive.slice(5), 2025)!)).toBeNull();
	});

	it('treats a watch on release day as the fastest possible turnaround', () => {
		const scene = shelfScene(buildWrapped([...archive.slice(5), openingDay], 2025)!);
		expect(scene?.value).toBe('0');
		expect(scene?.note).toBe('You watched Premiere Night on the day it opened.');
	});
});
