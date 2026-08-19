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

describe('freshnessScene', () => {
	it('reports the share of the year that was new', () => {
		const scene = freshnessScene(buildWrapped(archive, 2025)!);
		expect(scene).toMatchObject({ id: 'new-releases', value: '23%' });
		expect(scene?.body.kind).toBe('posters');
	});

	it('drops out with fewer than three releases from the year', () => {
		const old = archive.slice(3);
		expect(freshnessScene(buildWrapped(old, 2025)!)).toBeNull();
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
