import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '../library';
import { freshness, longestWait, quickestWatch, releaseLags } from './release';

const stalker = film({
	name: 'Stalker',
	...watched(['2025-04-12']),
	tmdb: tmdb({ releaseDate: '1979-05-13', year: 1979 })
});
const brutalist = film({
	name: 'The Brutalist',
	...watched(['2025-01-27']),
	tmdb: tmdb({ releaseDate: '2025-01-24', year: 2025 })
});
const undated = film({ ...watched(['2025-02-02']), tmdb: tmdb({ releaseDate: null, year: null }) });

const library = buildLibrary({ films: [stalker, brutalist, undated], year: 2025 });

describe('releaseLags', () => {
	it('measures from release to the first watch inside the year', () => {
		const lags = releaseLags(library);
		expect(lags).toHaveLength(2);
		expect(lags.find((lag) => lag.film === brutalist)?.days).toBe(3);
	});
});

describe('longestWait', () => {
	it('names the film that waited longest, in whole years', () => {
		expect(longestWait(library)).toMatchObject({
			film: stalker,
			years: 45,
			released: '1979-05-13',
			watched: '2025-04-12',
			overTwenty: 1
		});
	});

	it('drops out when nothing waited five years', () => {
		expect(longestWait(buildLibrary({ films: [brutalist], year: 2025 }))).toBeNull();
	});
});

describe('quickestWatch', () => {
	it('names the film that reached the viewer fastest', () => {
		expect(quickestWatch(library)).toMatchObject({ film: brutalist, days: 3, insideThirty: 1 });
	});

	it('drops out when nothing arrived inside thirty days', () => {
		expect(quickestWatch(buildLibrary({ films: [stalker], year: 2025 }))).toBeNull();
	});
});

describe('freshness', () => {
	const releases = (count: number, current: number) =>
		Array.from({ length: count }, (_, i) =>
			film({
				...watched([`2025-06-${String((i % 28) + 1).padStart(2, '0')}`]),
				rating: 4,
				tmdb: tmdb({
					releaseDate: i < current ? '2025-03-01' : '1994-03-01',
					year: i < current ? 2025 : 1994
				})
			})
		);

	it('reports the share released in the deck year', () => {
		const result = freshness(buildLibrary({ films: releases(20, 5), year: 2025 }));
		expect(result?.thisYear).toBe(5);
		expect(result?.share).toBeCloseTo(0.25);
		expect(result?.preMillennium).toBe(15);
		expect(result?.films).toHaveLength(5);
	});

	it('drops out under three releases from the year', () => {
		expect(freshness(buildLibrary({ films: releases(20, 3), year: 2025 }))).not.toBeNull();
		expect(freshness(buildLibrary({ films: releases(20, 2), year: 2025 }))).toBeNull();
	});

	it('drops out under twenty dated films', () => {
		expect(freshness(buildLibrary({ films: releases(19, 5), year: 2025 }))).toBeNull();
	});
});
