import { describe, expect, it } from 'vitest';
import { tmdb } from '$lib/testing/fixtures';
import { RELEASE_KINDS, type FilmReleases, type ReleaseKind, type WatchlistFilm } from '$lib/types';
import {
	calendarEntries,
	clampMonth,
	monthGrid,
	nextReleaseMonth,
	recommendedCalendarFilm,
	shiftMonth,
	upcomingCandidates,
	watchlistCalendarFilm,
	type ReleaseCache
} from './calendar';

function listed(name: string, over: Parameters<typeof tmdb>[0] = {}): WatchlistFilm {
	return { uri: `https://boxd.it/${name}`, name, year: null, added: null, tmdb: tmdb(over) };
}

const idOf = (film: WatchlistFilm) => film.tmdb!.tmdbId;
const cacheOf = (entries: [number, FilmReleases | null][]): ReleaseCache => new Map(entries);
const describeEntries = (entries: ReturnType<typeof calendarEntries>) =>
	entries.map(
		(e) => `${e.date} ${e.film.name} ${e.kind}${e.fallbackRegion ? ` ${e.fallbackRegion}` : ''}`
	);

const recommendation = (reason: string, kinds: ReleaseKind[] = [...RELEASE_KINDS]) =>
	recommendedCalendarFilm(tmdb(), { score: 1, reason, kinds });

const cal = watchlistCalendarFilm;

const usOnly: FilmReleases = { US: [['theatrical', '2026-12-01']] };

describe('upcomingCandidates', () => {
	it('keeps undated and recent movies, drops old films, series and TheTVDB records', () => {
		const recent = listed('Recent', { releaseDate: '2026-01-10' });
		const undated = listed('Undated', { releaseDate: null });
		const old = listed('Old', { releaseDate: '2019-01-01' });
		const series = listed('Series', { releaseDate: null, mediaType: 'tv' });
		const tvdb = listed('Tvdb', { releaseDate: null, tmdbId: -5 });
		const ids = upcomingCandidates([recent, undated, old, series, tvdb], '2026-11-14');
		expect(ids).toEqual([idOf(recent), idOf(undated)]);
	});
});

describe('calendarEntries', () => {
	const alpha = listed('Alpha');
	const beta = listed('Beta');
	const cache: ReleaseCache = cacheOf([
		[
			idOf(alpha),
			{
				DE: [
					['theatrical', '2026-12-18'],
					['digital', '2027-02-01'],
					['physical', '2026-10-01']
				],
				US: [['theatrical', '2026-11-20']]
			}
		],
		[idOf(beta), { US: [['physical', '2026-12-18']] }]
	]);

	it("shows the chosen country's dates from the start date on, by date then title", () => {
		const entries = calendarEntries(
			[cal(beta), cal(alpha)],
			cache,
			'DE',
			RELEASE_KINDS,
			'2026-11-01'
		);
		expect(describeEntries(entries)).toEqual([
			'2026-12-18 Alpha theatrical',
			'2026-12-18 Beta physical US',
			'2027-02-01 Alpha digital'
		]);
	});

	it('shows nothing for a film TMDB has no dates for, or one not looked up yet', () => {
		const none = listed('None');
		const unknown = listed('Unknown');
		const withNone: ReleaseCache = cacheOf([[idOf(none), null]]);
		expect(
			calendarEntries([cal(none), cal(unknown)], withNone, 'DE', RELEASE_KINDS, '2026-01-01')
		).toEqual([]);
	});

	it('never gives a series the dates of the movie sharing its id', () => {
		const series = listed('Series', { mediaType: 'tv' });
		const shared: ReleaseCache = cacheOf([[idOf(series), { US: [['digital', '2027-01-01']] }]]);
		expect(calendarEntries([cal(series)], shared, 'US', RELEASE_KINDS, '2026-01-01')).toEqual([]);
	});

	it('keeps a watchlist film fallback date but drops a recommended one', () => {
		const watchlist = cal(listed('Listed'));
		const rec = recommendation('Director');
		const cache = new Map([
			[watchlist.tmdb!.tmdbId, usOnly],
			[rec.tmdb!.tmdbId, usOnly]
		]);
		const entries = calendarEntries([watchlist, rec], cache, 'DE', ['theatrical'], '2026-01-01');
		expect(entries.map((entry) => entry.film)).toEqual([watchlist]);
		expect(entries[0].fallbackRegion).toBe('US');
	});

	it('keeps a recommended film release in the chosen region', () => {
		const rec = recommendation('Cast');
		const cache = new Map([
			[rec.tmdb!.tmdbId, { DE: [['digital', '2026-12-02']] } as FilmReleases]
		]);
		expect(calendarEntries([rec], cache, 'DE', ['digital'], '2026-01-01')).toHaveLength(1);
	});

	it('filters by kind and start date, keeping a release on the start date itself', () => {
		const film = listed('Kinds');
		const releases: FilmReleases = {
			DE: [
				['theatrical', '2026-10-01'],
				['theatrical', '2026-11-01'],
				['theatrical', '2026-12-01'],
				['digital', '2026-12-05']
			]
		};
		const cache = new Map([[film.tmdb!.tmdbId, releases]]);
		const entries = calendarEntries([cal(film)], cache, 'DE', ['theatrical'], '2026-11-01');
		expect(entries.map(({ kind, date }) => [kind, date])).toEqual([
			['theatrical', '2026-11-01'],
			['theatrical', '2026-12-01']
		]);
	});

	it('shows a recommendation only in the kinds its search covered', () => {
		const rec = recommendation('Keywords', ['digital']);
		const cache = new Map([
			[
				rec.tmdb!.tmdbId,
				{
					DE: [
						['theatrical', '2026-12-01'],
						['digital', '2026-12-05']
					]
				} as FilmReleases
			]
		]);
		const entries = calendarEntries([rec], cache, 'DE', ['theatrical'], '2026-01-01');
		expect(entries.map(({ kind }) => kind)).toEqual(['digital']);
	});
});

describe('calendar films', () => {
	it('links a watchlist film to Letterboxd and a recommendation to TMDB', () => {
		expect(cal(listed('Linked')).href).toBe('https://boxd.it/Linked');
		const rec = recommendation('Cast');
		expect(rec.href).toBe(`https://www.themoviedb.org/movie/${rec.tmdb!.tmdbId}`);
	});

	it('leaves a watchlist film with an unsafe URI unlinked', () => {
		expect(cal({ ...listed('Odd'), uri: 'javascript:alert(1)' }).href).toBeNull();
	});
});

describe('month navigation', () => {
	it('steps across year boundaries', () => {
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
	});

	it('clamps a month into the range that has releases', () => {
		expect(clampMonth('2027-08', '2026-11', '2027-02')).toBe('2027-02');
		expect(clampMonth('2026-09', '2026-11', '2027-02')).toBe('2026-11');
		expect(clampMonth('2026-12', '2026-11', '2027-02')).toBe('2026-12');
	});

	it('finds the next month with a release, never an earlier one', () => {
		const later = listed('Later');
		const cache: ReleaseCache = cacheOf([
			[
				idOf(later),
				{
					US: [
						['digital', '2026-11-20'],
						['physical', '2027-03-02']
					]
				}
			]
		]);
		const entries = calendarEntries([cal(later)], cache, 'US', RELEASE_KINDS, '2026-11-01');
		expect(nextReleaseMonth(entries, '2026-12')).toBe('2027-03');
		expect(nextReleaseMonth(entries, '2027-03')).toBeNull();
	});
});

describe('monthGrid', () => {
	it('pads a month to whole Monday-first weeks and puts entries on their day', () => {
		const film = listed('Gridded');
		const cache: ReleaseCache = cacheOf([[idOf(film), { US: [['digital', '2026-12-18']] }]]);
		const entries = calendarEntries([cal(film)], cache, 'US', RELEASE_KINDS, '2026-12-01');
		const days = monthGrid('2026-12', entries);
		expect(days.length % 7).toBe(0);
		expect(days[0].date).toBeNull();
		expect(days[1].date).toBe('2026-12-01');
		expect(days.filter((d) => d.date).length).toBe(31);
		expect(days.find((d) => d.date === '2026-12-18')?.entries).toHaveLength(1);
	});
});
