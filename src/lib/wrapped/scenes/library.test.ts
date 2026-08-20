import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from '../wrapped';
import {
	breadthScene,
	collectionScene,
	likedScene,
	tagScene,
	watchlistAgeScene,
	watchlistScene,
	writingScene
} from './library';

const now = new Date('2026-01-15T00:00:00Z');
const base = (over: Parameters<typeof film>[0] = {}, count = 12) =>
	Array.from({ length: count }, (_, i) =>
		film({ ...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]), tmdb: tmdb(), ...over })
	);
const watchlist = Array.from({ length: 40 }, (_, i) => ({
	uri: `w${i}`,
	name: `Queued ${i}`,
	year: 2000,
	added: i < 6 ? '2025-04-04' : '2019-01-01'
}));
// Ascending distance from `now`, one day apart, so the median (13 days) and the oldest
// (25 days) land on different values — a fixture that let them coincide could not tell a
// correct median formula from one that just re-reports the oldest entry's age.
const agedDates = [
	'2026-01-14',
	'2026-01-13',
	'2026-01-12',
	'2026-01-11',
	'2026-01-10',
	'2026-01-09',
	'2026-01-08',
	'2026-01-07',
	'2026-01-06',
	'2026-01-05',
	'2026-01-04',
	'2026-01-03',
	'2026-01-02',
	'2026-01-01',
	'2025-12-31',
	'2025-12-30',
	'2025-12-29',
	'2025-12-28',
	'2025-12-27',
	'2025-12-26',
	'2025-12-25',
	'2025-12-24',
	'2025-12-23',
	'2025-12-22',
	'2025-12-21'
];
const agedWatchlist = agedDates.map((added, i) => ({
	uri: `aged${i}`,
	name: `Aged ${i + 1}`,
	year: 2000,
	added
}));

describe('writingScene', () => {
	it('counts words and names the longest review', () => {
		const films = [...base({ review: 'a b c' }, 3), ...base({}, 9)];
		const scene = writingScene(buildWrapped(films, 2025)!);
		expect(scene).toMatchObject({ id: 'words', value: '9' });
		expect(scene?.stats.find((stat) => stat.label === 'Reviews')?.value).toBe('3');
	});

	it('cites the longest review by name and the total silence', () => {
		const films = [
			film({ ...watched(['2025-01-01']), name: 'Talkative', review: 'one two three four five' }),
			film({ ...watched(['2025-02-01']), review: 'short review' }),
			film({ ...watched(['2025-03-01']), review: 'another one here' }),
			...base({}, 9)
		];
		const scene = writingScene(buildWrapped(films, 2025)!);
		expect(scene?.value).toBe('10');
		expect(scene?.note).toBe('3 reviews, 10 words. The longest ran to 5 words, on Talkative.');
		expect(scene?.stats).toEqual([
			{ label: 'Reviews', value: '3' },
			{ label: 'Longest', value: '5 words' },
			{ label: 'Left in silence', value: '9' }
		]);
	});

	it('drops out with too few reviews', () => {
		const films = [...base({ review: 'one two' }, 2), ...base({}, 10)];
		expect(writingScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('drops out rather than headline a zero when every review is empty of words', () => {
		const films = [...base({ review: '   ' }, 3), ...base({}, 9)];
		expect(writingScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});

describe('watchlistScene', () => {
	it('turns the queue into a number of years', () => {
		const scene = watchlistScene(buildWrapped(base({}, 20), 2025, { watchlist })!);
		expect(scene).toMatchObject({ id: 'watchlist', value: '2.0' });
		expect(scene?.note).toContain('40');
	});

	it('cites the same watched figure in the note and the stats', () => {
		const scene = watchlistScene(buildWrapped(base({}, 20), 2025, { watchlist })!);
		expect(scene?.note).toBe(
			'40 films on your watchlist. At 20 a year, and assuming you never add another, that is 2.0 years of viewing.'
		);
		expect(scene?.stats).toEqual([
			{ label: 'On the watchlist', value: '40' },
			{ label: 'Watched this year', value: '20' },
			{ label: 'Added this year', value: '6' }
		]);
	});

	it('names the film that has waited longest', () => {
		const scene = watchlistAgeScene(buildWrapped(base({}, 20), 2025, { watchlist, now })!);
		expect(scene).toMatchObject({ id: 'watchlist-age', valueKind: 'name', value: 'Queued 6' });
		expect(scene?.note).toBe(
			'You added it on 1 January 2019 and have not watched it since. That is 7.0 years of good intentions.'
		);
		expect(scene?.stats).toEqual([
			{ label: 'Added', value: '1 January 2019' },
			{ label: 'Waiting', value: '7.0 years' },
			{ label: 'Median age', value: '7.0 years' }
		]);
	});

	it('computes the median across every dated entry, not just the oldest', () => {
		const scene = watchlistAgeScene(
			buildWrapped(base({}, 20), 2025, { watchlist: agedWatchlist, now })!
		);
		expect(scene?.value).toBe('Aged 25');
		expect(scene?.stats.find((stat) => stat.label === 'Waiting')?.value).toBe('25 days');
		expect(scene?.stats.find((stat) => stat.label === 'Median age')?.value).toBe('13 days');
	});

	it('drops out without a watchlist', () => {
		expect(watchlistScene(buildWrapped(base({}, 20), 2025)!)).toBeNull();
		expect(watchlistAgeScene(buildWrapped(base({}, 20), 2025)!)).toBeNull();
	});

	it('drops out when the queue is long enough but the year was too thin', () => {
		const thin = Array.from({ length: 30 }, (_, i) => ({
			uri: `q${i}`,
			name: `Q${i}`,
			year: 2000,
			added: null
		}));
		expect(watchlistScene(buildWrapped(base({}, 11), 2025, { watchlist: thin })!)).toBeNull();
	});

	it('renders the maths on the full queue even when too few entries carry a date', () => {
		// 30 entries clears watchlistScene's size gate (>=25); only 10 of them are dated, which
		// fails watchlistAge's own gate (>=25 dated) on its own denominator. The two facts gate on
		// different populations of the same watchlist, so one dropping out must not silence the
		// other.
		const mixedWatchlist = [
			...Array.from({ length: 10 }, (_, i) => ({
				uri: `d${i}`,
				name: `Dated ${i}`,
				year: 2000,
				added: '2024-01-01'
			})),
			...Array.from({ length: 20 }, (_, i) => ({
				uri: `u${i}`,
				name: `Undated ${i}`,
				year: 2000,
				added: null
			}))
		];
		const scene = watchlistScene(buildWrapped(base({}, 20), 2025, { watchlist: mixedWatchlist })!);
		expect(scene?.value).toBe('1.5');
		expect(
			watchlistAgeScene(buildWrapped(base({}, 20), 2025, { watchlist: mixedWatchlist, now })!)
		).toBeNull();
	});
});

describe('breadthScene', () => {
	const person = (id: number) => ({ name: `Director ${id}`, tmdbId: id, profilePath: null });

	it('sets the count of directors against the ones returned to', () => {
		const films = [
			...base({ tmdb: tmdb({ directors: [person(1)] }) }, 4),
			...Array.from({ length: 12 }, (_, i) =>
				film({ ...watched(['2025-08-01']), tmdb: tmdb({ directors: [person(i + 10)] }) })
			)
		];
		const scene = breadthScene(buildWrapped(films, 2025)!);
		expect(scene).toMatchObject({ id: 'breadth', value: '13' });
		expect(scene?.note).toBe('13 directors across 16 films. You went back to one of them.');
		expect(scene?.stats).toEqual([
			{ label: 'Seen more than once', value: '1' },
			{ label: 'Four or more', value: '1' },
			{ label: 'Most watched', value: 'Director 1, 4' }
		]);
	});

	it('drops out when too few films have a credited director', () => {
		const films = base({ tmdb: tmdb({ directors: [person(1)] }) }, 10);
		expect(breadthScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('drops out when no director was returned to at least four times', () => {
		const films = Array.from({ length: 16 }, (_, i) =>
			film({ ...watched(['2025-08-01']), tmdb: tmdb({ directors: [person(i + 1)] }) })
		);
		expect(breadthScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});

describe('likedScene', () => {
	it('names the hearted film with the lowest rating', () => {
		const films = [
			film({ ...watched(['2025-01-01']), name: 'Road House', liked: true, rating: 2.5 }),
			...base({ liked: true, rating: 4.5 }, 11)
		];
		const scene = likedScene(buildWrapped(films, 2025)!);
		expect(scene).toMatchObject({ id: 'liked', value: 'Road House' });
		expect(scene?.note).toBe(
			'You hearted it and gave it ★ 2.50. 0 other films got a heart without four stars.'
		);
		expect(scene?.stats).toEqual([
			{ label: 'Rating', value: '★ 2.50' },
			{ label: 'Hearts this year', value: '12' },
			{ label: 'Hearts under ★ 4', value: '1' }
		]);
	});

	it('drops out when too few films were hearted', () => {
		const films = [...base({ liked: true, rating: 3 }, 4), ...base({}, 8)];
		expect(likedScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('drops out when hearted films carry no rating', () => {
		const films = [...base({ liked: true, rating: null }, 6), ...base({}, 6)];
		expect(likedScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('drops out when every hearted film already earned four stars or more', () => {
		const films = [...base({ liked: true, rating: 4.5 }, 6), ...base({}, 6)];
		expect(likedScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});

describe('collectionScene', () => {
	const alien = { id: 8091, name: 'Alien Collection', posterPath: null };
	const alienFilms = () =>
		Array.from({ length: 5 }, (_, i) =>
			film({ ...watched([`2025-0${i + 2}-08`]), tmdb: tmdb({ collection: alien }) })
		);

	it('says how many of the franchise the year covered', () => {
		const films = [...alienFilms(), ...base({}, 7)];
		const scene = collectionScene(
			buildWrapped(films, 2025, { collections: [{ id: 8091, name: 'Alien', total: 6 }] })!
		);
		expect(scene).toMatchObject({ id: 'collection', value: 'Alien' });
		// The note sentence is capitalised, so it reads "Five", not the fixture-supplied "five".
		expect(scene?.note).toBe(
			'Five of the six films in the Alien collection, between 8 February and 8 June.'
		);
		expect(scene?.stats).toEqual([
			{ label: 'Films', value: '5 of 6' },
			{ label: 'First', value: '8 February' },
			{ label: 'Last', value: '8 June' }
		]);
	});

	it('counts every film the year covered even past the six-poster cap', () => {
		// 9 films in the franchise: the poster row caps at 6, but the count in the note and the
		// "Films" stat must reflect all 9 watched, not just the 6 that get a poster.
		const films = [
			...Array.from({ length: 9 }, (_, i) =>
				film({ ...watched([`2025-0${i + 1}-08`]), tmdb: tmdb({ collection: alien }) })
			),
			...base({}, 3)
		];
		const scene = collectionScene(
			buildWrapped(films, 2025, { collections: [{ id: 8091, name: 'Alien', total: 20 }] })!
		);
		expect(scene?.note).toBe(
			'Nine of the 20 films in the Alien collection, between 8 January and 8 September.'
		);
		expect(scene?.stats.find((stat) => stat.label === 'Films')?.value).toBe('9 of 20');
		if (scene?.body.kind !== 'posters') throw new Error('expected a posters body');
		expect(scene.body.posters).toHaveLength(6);
	});

	it('describes the set without a total when the franchise size is unknown', () => {
		const films = [...alienFilms(), ...base({}, 7)];
		const scene = collectionScene(buildWrapped(films, 2025)!);
		expect(scene?.note).toBe(
			'Five films from the Alien collection, between 8 February and 8 June.'
		);
		expect(scene?.stats.find((stat) => stat.label === 'Films')?.value).toBe('5');
	});

	it('drops out when no collection has enough films', () => {
		expect(collectionScene(buildWrapped(base({}, 12), 2025)!)).toBeNull();
	});

	it('drops out when the largest shared collection has fewer than three films', () => {
		const films = [
			film({ ...watched(['2025-02-08']), tmdb: tmdb({ collection: alien }) }),
			film({ ...watched(['2025-03-08']), tmdb: tmdb({ collection: alien }) }),
			...base({}, 10)
		];
		expect(collectionScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});

describe('tagScene', () => {
	it('names the most-used tag', () => {
		const films = [...base({ tags: ['cinema'] }, 8), ...base({ tags: ['drama'] }, 4)];
		const scene = tagScene(buildWrapped(films, 2025)!);
		expect(scene).toMatchObject({ id: 'tag', value: 'cinema' });
		// The 8 uses of "cinema" and the 12 tagged films overall are different populations; a
		// fixture where every film shared one tag could not tell these two figures apart.
		expect(scene?.note).toBe('You tagged 8 films "cinema", out of 12 tagged films in all.');
		expect(scene?.stats).toEqual([
			{ label: 'Tags used', value: '2' },
			{ label: 'Most used', value: 'cinema, 8' },
			{ label: 'Tagged films', value: '12' }
		]);
	});

	it('drops out when nothing was tagged', () => {
		expect(tagScene(buildWrapped(base(), 2025)!)).toBeNull();
	});

	it('drops out when the most-used tag was not used enough', () => {
		const films = [...base({ tags: ['cinema'] }, 4), ...base({}, 8)];
		expect(tagScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});
