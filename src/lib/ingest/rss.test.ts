import { describe, expect, it } from 'vitest';
import { FEED_FILM_LIMIT, feedHasGap, mergeFeed, parseFeed, type FeedEntry } from './rss';
import type { Film } from '$lib/types';

const REVIEW_ITEM = `<item>
	<title>Stalker, 1979 - ★★★★½</title>
	<link>https://letterboxd.com/someone/film/stalker/1/</link>
	<guid isPermaLink="false">letterboxd-review-1</guid>
	<letterboxd:watchedDate>2026-09-30</letterboxd:watchedDate>
	<letterboxd:rewatch>Yes</letterboxd:rewatch>
	<letterboxd:filmTitle>Stalker</letterboxd:filmTitle>
	<letterboxd:filmYear>1979</letterboxd:filmYear>
	<letterboxd:memberRating>4.5</letterboxd:memberRating>
	<letterboxd:memberLike>Yes</letterboxd:memberLike>
	<description><![CDATA[ <p><img src="https://a.ltrbxd.com/poster.jpg"/></p> <p>This review may contain spoilers.</p> <p>The zone &amp; the room.</p> ]]></description>
</item>`;

const WATCH_ITEM = `<item>
	<link>https://letterboxd.com/someone/film/dont-look-now/</link>
	<guid isPermaLink="false">letterboxd-watch-2</guid>
	<letterboxd:watchedDate>2026-09-28</letterboxd:watchedDate>
	<letterboxd:rewatch>No</letterboxd:rewatch>
	<letterboxd:filmTitle>Don&#039;t Look Now</letterboxd:filmTitle>
	<letterboxd:filmYear>1973</letterboxd:filmYear>
	<letterboxd:memberLike>No</letterboxd:memberLike>
	<description><![CDATA[ <p><img src="x.jpg"/></p> <p>Watched on Monday September 28, 2026.</p> ]]></description>
</item>`;

const LIST_ITEM = `<item><title>Favourites</title><guid isPermaLink="false">letterboxd-list-3</guid></item>`;

function film(overrides: Partial<Film>): Film {
	return {
		uri: 'https://boxd.it/a',
		name: 'Stalker',
		year: 1979,
		rating: 4,
		liked: false,
		review: null,
		watchedDates: [],
		entries: [],
		rewatch: false,
		tags: [],
		...overrides
	};
}

function entry(date: string, name = 'Stalker'): FeedEntry {
	return { uri: '', name, year: 1979, date, rating: 3, rewatch: false, liked: false, review: null };
}

describe('parseFeed', () => {
	const feed = parseFeed(`<rss><channel>${REVIEW_ITEM}${WATCH_ITEM}${LIST_ITEM}</channel></rss>`);

	it('reads film items and skips lists', () => {
		expect(feed).toHaveLength(2);
	});

	it('reads the fields of a review item', () => {
		expect(feed[0]).toEqual({
			uri: 'https://letterboxd.com/film/stalker/',
			name: 'Stalker',
			year: 1979,
			date: '2026-09-30',
			rating: 4.5,
			rewatch: true,
			liked: true,
			review: 'The zone & the room.'
		});
	});

	it('decodes titles and keeps the "Watched on" line out of reviews', () => {
		expect(feed[1].name).toBe("Don't Look Now");
		expect(feed[1].rating).toBeNull();
		expect(feed[1].review).toBeNull();
	});
});

describe('mergeFeed', () => {
	const asIs = (f: Film) => f;

	it('adds a new viewing to a known film without mutating the library', () => {
		const library = [
			film({
				watchedDates: ['2020-01-01'],
				entries: [{ date: '2020-01-01', rating: 4, rewatch: false }]
			})
		];
		const merged = mergeFeed(library, [entry('2026-09-30')], asIs);
		expect(merged.addedEntries).toBe(1);
		expect(merged.newFilms).toHaveLength(0);
		expect(merged.films[0].watchedDates).toEqual(['2020-01-01', '2026-09-30']);
		expect(merged.films[0].rating).toBe(3);
		expect(library[0].watchedDates).toEqual(['2020-01-01']);
	});

	it('does not count a viewing the export already holds', () => {
		const library = [
			film({
				watchedDates: ['2026-09-30'],
				entries: [{ date: '2026-09-30', rating: 3, rewatch: false }]
			})
		];
		expect(mergeFeed(library, [entry('2026-09-30')], asIs).addedEntries).toBe(0);
	});

	it('keeps the current rating when the feed entry is older than the latest viewing', () => {
		const library = [film({ rating: 5, watchedDates: ['2026-10-01'] })];
		expect(mergeFeed(library, [entry('2026-09-01')], asIs).films[0].rating).toBe(5);
	});

	it('creates films the library does not have', () => {
		const merged = mergeFeed([], [entry('2026-09-30', 'Mirror')], asIs);
		expect(merged.newFilms.map((f) => f.name)).toEqual(['Mirror']);
		expect(merged.films[0].entries).toEqual([{ date: '2026-09-30', rating: 3, rewatch: false }]);
	});
});

describe('feedHasGap', () => {
	const full = Array.from({ length: FEED_FILM_LIMIT }, () => entry('2026-09-01'));

	it('flags a full feed that starts after the last known viewing', () => {
		expect(feedHasGap([film({ watchedDates: ['2026-01-01'] })], full)).toBe(true);
	});

	it('trusts a feed that is not full, since it holds the whole history', () => {
		expect(feedHasGap([film({ watchedDates: ['2026-01-01'] })], full.slice(1))).toBe(false);
	});

	it('finds no gap when the feed overlaps the library', () => {
		expect(feedHasGap([film({ watchedDates: ['2026-09-01'] })], full)).toBe(false);
	});
});
