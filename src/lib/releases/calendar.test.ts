import { describe, expect, it } from 'vitest';
import { tmdb } from '$lib/testing/fixtures';
import { calendarEntries, sortEntries, type CalendarEntry, type CalendarFilm } from './calendar';
import type { FilmReleases } from './dates';

function calendarFilm(over: Partial<CalendarFilm> = {}): CalendarFilm {
	const movie = tmdb();
	return { name: movie.title, year: 2026, uri: null, tmdb: movie, ...over };
}

const usOnly: FilmReleases = { US: [['theatrical', '2026-12-01']] };

describe('calendarEntries', () => {
	it('keeps a watchlist film fallback date but drops a recommended one', () => {
		const watchlist = calendarFilm({ uri: 'https://boxd.it/a' });
		const rec = calendarFilm({ recommended: { score: 1, reason: 'Director' } });
		const cache = new Map([
			[watchlist.tmdb!.tmdbId, usOnly],
			[rec.tmdb!.tmdbId, usOnly]
		]);
		const entries = calendarEntries([watchlist, rec], cache, 'DE', ['theatrical'], '2026-01-01');
		expect(entries.map((entry) => entry.film)).toEqual([watchlist]);
		expect(entries[0].fallbackRegion).toBe('US');
	});

	it('keeps a recommended film release in the chosen region', () => {
		const rec = calendarFilm({ recommended: { score: 1, reason: 'Cast' } });
		const cache = new Map([
			[rec.tmdb!.tmdbId, { DE: [['digital', '2026-12-02']] } as FilmReleases]
		]);
		expect(calendarEntries([rec], cache, 'DE', ['digital'], '2026-01-01')).toHaveLength(1);
	});

	it('filters by kind and start date', () => {
		const film = calendarFilm();
		const releases: FilmReleases = {
			DE: [
				['theatrical', '2026-10-01'],
				['theatrical', '2026-12-01'],
				['digital', '2026-12-05']
			]
		};
		const cache = new Map([[film.tmdb!.tmdbId, releases]]);
		const entries = calendarEntries([film], cache, 'DE', ['theatrical'], '2026-11-01');
		expect(entries.map(({ kind, date }) => [kind, date])).toEqual([['theatrical', '2026-12-01']]);
	});
});

describe('sortEntries', () => {
	it('orders by date and then name', () => {
		const entry = (name: string, date: string): CalendarEntry => ({
			film: calendarFilm({ name }),
			kind: 'theatrical',
			date,
			fallbackRegion: null
		});
		const sorted = sortEntries([
			entry('B', '2026-12-02'),
			entry('C', '2026-12-01'),
			entry('A', '2026-12-02')
		]);
		expect(sorted.map(({ film }) => film.name)).toEqual(['C', 'A', 'B']);
	});
});
