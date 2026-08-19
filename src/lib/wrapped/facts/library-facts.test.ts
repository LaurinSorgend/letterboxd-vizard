import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '../library';
import {
	biggestCollection,
	directorBreadth,
	likedNotLoved,
	topTag,
	watchlistAge,
	watchlistMaths,
	writing
} from './library-facts';

const now = new Date('2026-01-15T00:00:00Z');
const bulk = (count: number, over: Parameters<typeof film>[0] = {}) =>
	Array.from({ length: count }, (_, i) =>
		film({ ...watched([`2025-0${(i % 9) + 1}-01`]), ...over })
	);

describe('writing', () => {
	it('counts reviews and words and names the longest', () => {
		const long = film({
			...watched(['2025-02-01']),
			name: 'Anatomy of a Fall',
			review: 'a '.repeat(60)
		});
		const short = film({ ...watched(['2025-02-02']), review: 'terse but fair' });
		const third = film({ ...watched(['2025-02-03']), review: 'one two three' });
		const result = writing(buildLibrary({ films: [long, short, third, ...bulk(5)], year: 2025 }));
		expect(result).toMatchObject({ reviews: 3, words: 66, silent: 5 });
		expect(result?.longest).toMatchObject({ film: long, words: 60 });
	});

	it('drops out under three reviews', () => {
		const one = film({ ...watched(['2025-02-01']), review: 'brief' });
		expect(writing(buildLibrary({ films: [one, ...bulk(5)], year: 2025 }))).toBeNull();
	});
});

describe('watchlistMaths', () => {
	const watchlist = Array.from({ length: 40 }, (_, i) => ({
		uri: `w${i}`,
		name: `Queued ${i}`,
		year: 2000,
		added: i < 6 ? '2025-04-04' : '2019-01-01'
	}));

	it('divides the queue by the year to get a number of years', () => {
		const result = watchlistMaths(buildLibrary({ films: bulk(20), year: 2025, watchlist }));
		expect(result).toMatchObject({ size: 40, watched: 20, addedThisYear: 6 });
		expect(result?.years).toBeCloseTo(2);
	});

	it('drops out on a watchlist under twenty-five', () => {
		const short = watchlist.slice(0, 24);
		expect(
			watchlistMaths(buildLibrary({ films: bulk(20), year: 2025, watchlist: short }))
		).toBeNull();
	});

	it('names the film that has waited longest', () => {
		const result = watchlistAge(buildLibrary({ films: bulk(20), year: 2025, watchlist, now }));
		expect(result?.oldest).toMatchObject({ name: 'Queued 6', added: '2019-01-01' });
		expect(result?.oldest.days).toBe(2571);
	});

	it('takes the upper median day-gap, matching the rest of the codebase', () => {
		// 30 distinct added-dates, one day apart: 2024-01-01 .. 2024-01-30, against
		// now = 2024-03-01. Day-gaps run from 60 (2024-01-01, oldest) down to 31
		// (2024-01-30, newest): 30 consecutive integers, no ties. The true median sits
		// between the 15th and 16th ascending values (0-indexed 14 and 15): 45 and 46.
		// recap.ts's and stats.ts's convention (sort ascending, take floor(n/2)) picks
		// the upper one, 46. The old descending-sort-then-floor(n/2) code picked the
		// lower one, 45 -- this pins the fix to the upper convention.
		const distinct = Array.from({ length: 30 }, (_, i) => ({
			uri: `d${i}`,
			name: `Distinct ${i}`,
			year: 2000,
			added: `2024-01-${String(i + 1).padStart(2, '0')}`
		}));
		const result = watchlistAge(
			buildLibrary({
				films: bulk(12),
				year: 2025,
				watchlist: distinct,
				now: new Date('2024-03-01T00:00:00Z')
			})
		);
		expect(result?.medianDays).toBe(46);
	});

	it('drops out when too few entries carry a date, even with a large watchlist', () => {
		const sparse = Array.from({ length: 25 }, (_, i) => ({
			uri: `s${i}`,
			name: `Sparse ${i}`,
			year: 2000,
			added: i < 10 ? '2020-01-01' : null
		}));
		const library = buildLibrary({ films: bulk(12), year: 2025, watchlist: sparse, now });
		expect(watchlistMaths(library)).not.toBeNull();
		expect(watchlistAge(library)).toBeNull();
	});
});

describe('directorBreadth', () => {
	const person = (id: number) => ({ name: `Director ${id}`, tmdbId: id, profilePath: null });

	it('counts distinct directors and the ones returned to', () => {
		const films = [
			...bulk(4, { tmdb: tmdb({ directors: [person(1)] }) }),
			...bulk(2, { tmdb: tmdb({ directors: [person(2)] }) }),
			...Array.from({ length: 10 }, (_, i) =>
				film({ ...watched(['2025-07-01']), tmdb: tmdb({ directors: [person(10 + i)] }) })
			)
		];
		expect(directorBreadth(buildLibrary({ films, year: 2025 }))).toMatchObject({
			directors: 12,
			repeat: 2,
			deep: 1,
			top: { name: 'Director 1', count: 4 }
		});
	});

	it('drops out when nobody reached four films', () => {
		const films = Array.from({ length: 16 }, (_, i) =>
			film({ ...watched(['2025-07-01']), tmdb: tmdb({ directors: [person(i)] }) })
		);
		expect(directorBreadth(buildLibrary({ films, year: 2025 }))).toBeNull();
	});
});

describe('likedNotLoved', () => {
	it('names the lowest-rated film that still got a heart', () => {
		const films = [
			film({ ...watched(['2025-01-01']), name: 'Road House', liked: true, rating: 2.5 }),
			...bulk(4, { liked: true, rating: 4.5 }),
			...bulk(5, { liked: true, rating: 3 })
		];
		const result = likedNotLoved(buildLibrary({ films, year: 2025 }));
		expect(result).toMatchObject({ rating: 2.5, hearts: 10, heartsUnderFour: 6 });
		expect(result?.film.name).toBe('Road House');
	});

	it('drops out when no hearted film sits under three and a half', () => {
		expect(
			likedNotLoved(buildLibrary({ films: bulk(10, { liked: true, rating: 4 }), year: 2025 }))
		).toBeNull();
	});
});

describe('biggestCollection', () => {
	const alien = { id: 8091, name: 'Alien Collection', posterPath: null };

	it('names the largest franchise worked through this year', () => {
		const films = [
			film({ ...watched(['2025-02-08']), tmdb: tmdb({ collection: alien }) }),
			film({ ...watched(['2025-03-08']), tmdb: tmdb({ collection: alien }) }),
			film({ ...watched(['2025-04-30']), tmdb: tmdb({ collection: alien }) })
		];
		const result = biggestCollection(
			buildLibrary({ films, year: 2025, collections: [{ id: 8091, name: 'Alien', total: 6 }] })
		);
		expect(result).toMatchObject({
			name: 'Alien',
			first: '2025-02-08',
			last: '2025-04-30',
			total: 6
		});
		expect(result?.shownFilms).toHaveLength(3);
	});

	it('reports a null total when the collection size was never fetched', () => {
		const films = Array.from({ length: 3 }, (_, i) =>
			film({ ...watched([`2025-0${i + 1}-01`]), tmdb: tmdb({ collection: alien }) })
		);
		expect(biggestCollection(buildLibrary({ films, year: 2025 }))?.total).toBeNull();
	});

	it('drops out under three films from one franchise', () => {
		const films = Array.from({ length: 2 }, () =>
			film({ ...watched(['2025-01-01']), tmdb: tmdb({ collection: alien }) })
		);
		expect(biggestCollection(buildLibrary({ films, year: 2025 }))).toBeNull();
	});
});

describe('topTag', () => {
	it('names the most-used tag', () => {
		const films = [...bulk(6, { tags: ['cinema'] }), ...bulk(2, { tags: ['cinema', 'rewatch'] })];
		expect(topTag(buildLibrary({ films, year: 2025 }))).toMatchObject({
			tag: 'cinema',
			count: 8,
			distinct: 2,
			tagged: 8
		});
	});

	it('drops out under five uses', () => {
		expect(topTag(buildLibrary({ films: bulk(4, { tags: ['cinema'] }), year: 2025 }))).toBeNull();
	});
});
