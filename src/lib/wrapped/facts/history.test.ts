import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '../library';
import {
	filmsPerYear,
	firstTimeDirectors,
	fiveStars,
	mostLogged,
	ratingDrift,
	ratingInYear
} from './history';

const sciamma = { name: 'Céline Sciamma', tmdbId: 1, profilePath: null };
const tarkovsky = { name: 'Andrei Tarkovsky', tmdbId: 2, profilePath: null };

const paddington = film({
	name: 'Paddington 2',
	entries: [
		{ date: '2019-03-01', rating: 3, rewatch: false },
		{ date: '2022-06-01', rating: 4, rewatch: true },
		{ date: '2025-02-01', rating: 4.5, rewatch: true },
		{ date: '2025-12-24', rating: 4.5, rewatch: true }
	],
	watchedDates: ['2019-03-01', '2022-06-01', '2025-02-01', '2025-12-24'],
	rating: 4.5
});

describe('filmsPerYear', () => {
	it('counts distinct films per calendar year with no gaps', () => {
		const library = buildLibrary({
			films: [paddington, film(watched(['2021-01-01'])), film(watched(['2021-02-02']))],
			year: 2025
		});
		expect(filmsPerYear(library)).toEqual([
			{ year: 2019, count: 1 },
			{ year: 2020, count: 0 },
			{ year: 2021, count: 2 },
			{ year: 2022, count: 1 },
			{ year: 2023, count: 0 },
			{ year: 2024, count: 0 },
			{ year: 2025, count: 1 }
		]);
	});
});

describe('mostLogged', () => {
	it('names the film with the most diary entries across the export', () => {
		const library = buildLibrary({
			films: [paddington, film(watched(['2025-01-01']))],
			year: 2025
		});
		expect(mostLogged(library)).toMatchObject({
			film: paddington,
			total: 4,
			first: '2019-03-01',
			thisYear: 2
		});
	});

	it('drops out when the most-logged film was not watched this year', () => {
		const old = film({
			...watched(['2019-01-01', '2019-02-01', '2019-03-01']),
			name: 'Old habit'
		});
		expect(mostLogged(buildLibrary({ films: [old], year: 2025 }))).toBeNull();
	});
});

describe('ratingInYear', () => {
	it('prefers the rating recorded on that year’s diary entry', () => {
		expect(ratingInYear(paddington, 2019)).toBe(3);
		expect(ratingInYear(paddington, 2025)).toBe(4.5);
		expect(ratingInYear(paddington, 2020)).toBeNull();
	});
});

describe('fiveStars', () => {
	const year = (y: number, count: number, rating: number) =>
		Array.from({ length: count }, (_, i) =>
			film({ ...watched([`${y}-0${(i % 9) + 1}-01`], rating), rating })
		);

	it('counts the top rating and compares against the year before', () => {
		const library = buildLibrary({
			films: [...year(2025, 20, 5), ...year(2025, 5, 3), ...year(2024, 9, 5)],
			year: 2025
		});
		expect(fiveStars(library)).toMatchObject({ count: 20, lastYear: 9, modal: 5 });
		expect(fiveStars(library)?.share).toBeCloseTo(20 / 25);
	});

	it('drops out under twenty rated films', () => {
		expect(fiveStars(buildLibrary({ films: year(2025, 19, 5), year: 2025 }))).toBeNull();
	});
});

describe('firstTimeDirectors', () => {
	it('counts directors with no earlier entry in the export', () => {
		const library = buildLibrary({
			films: [
				film({ ...watched(['2019-01-01']), tmdb: tmdb({ directors: [tarkovsky] }) }),
				film({ ...watched(['2025-03-01']), tmdb: tmdb({ directors: [tarkovsky] }) }),
				film({ ...watched(['2025-03-02']), tmdb: tmdb({ directors: [sciamma] }) }),
				film({ ...watched(['2025-06-02']), tmdb: tmdb({ directors: [sciamma] }) })
			],
			year: 2025
		});
		expect(firstTimeDirectors(library)).toMatchObject({
			directors: 1,
			top: { name: 'Céline Sciamma', count: 2 },
			byFirstTimers: 2
		});
	});

	it('drops out when the export holds only one year', () => {
		const library = buildLibrary({
			films: [film({ ...watched(['2025-03-01']), tmdb: tmdb({ directors: [sciamma] }) })],
			year: 2025
		});
		expect(firstTimeDirectors(library)).toBeNull();
	});

	it('keeps a genuine first-timer co-credited with a director who has an earlier entry', () => {
		const library = buildLibrary({
			films: [
				film({ ...watched(['2019-01-01']), tmdb: tmdb({ directors: [tarkovsky] }) }),
				film({ ...watched(['2025-03-01']), tmdb: tmdb({ directors: [tarkovsky, sciamma] }) })
			],
			year: 2025
		});
		expect(firstTimeDirectors(library)).toMatchObject({
			directors: 1,
			top: { name: 'Céline Sciamma', count: 1 },
			byFirstTimers: 1
		});
	});
});

describe('ratingDrift', () => {
	it('names the film whose rating moved most between viewings', () => {
		const library = buildLibrary({ films: [paddington], year: 2025 });
		expect(ratingDrift(library)).toMatchObject({
			film: paddington,
			before: { rating: 3, date: '2019-03-01' },
			after: { rating: 4.5, date: '2025-12-24' },
			delta: 1.5,
			rethought: 1
		});
	});

	it('drops out when nothing moved a full star', () => {
		const steady = film({
			entries: [
				{ date: '2019-01-01', rating: 4, rewatch: false },
				{ date: '2025-01-01', rating: 4.5, rewatch: true }
			],
			watchedDates: ['2019-01-01', '2025-01-01']
		});
		expect(ratingDrift(buildLibrary({ films: [steady], year: 2025 }))).toBeNull();
	});
});
