import { describe, expect, it } from 'vitest';
import {
	calendarEntries,
	clampMonth,
	monthGrid,
	nextReleaseMonth,
	shiftMonth,
	upcomingCandidates,
	type ReleaseCache
} from '$lib/releases/calendar';
import { RELEASE_KINDS, type FilmReleases } from '$lib/releases/dates';
import { compactReleases } from '$lib/server/releases';
import { tmdb } from '$lib/testing/fixtures';
import type { WatchlistFilm } from '$lib/types';

function listed(name: string, over: Parameters<typeof tmdb>[0] = {}): WatchlistFilm {
	return { uri: `https://boxd.it/${name}`, name, year: null, added: null, tmdb: tmdb(over) };
}

const idOf = (film: WatchlistFilm) => film.tmdb!.tmdbId;
const cacheOf = (entries: [number, FilmReleases | null][]): ReleaseCache => new Map(entries);
const describeEntries = (entries: ReturnType<typeof calendarEntries>) =>
	entries.map(
		(e) => `${e.date} ${e.film.name} ${e.kind}${e.fallbackRegion ? ` ${e.fallbackRegion}` : ''}`
	);

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
		const entries = calendarEntries([beta, alpha], cache, 'DE', RELEASE_KINDS, '2026-11-01');
		expect(describeEntries(entries)).toEqual([
			'2026-12-18 Alpha theatrical',
			'2026-12-18 Beta physical US',
			'2027-02-01 Alpha digital'
		]);
	});

	it('filters by release kind', () => {
		const entries = calendarEntries([alpha, beta], cache, 'DE', ['digital'], '2026-11-01');
		expect(describeEntries(entries)).toEqual(['2027-02-01 Alpha digital']);
	});

	it('shows nothing for a film TMDB has no dates for, or one not looked up yet', () => {
		const none = listed('None');
		const unknown = listed('Unknown');
		const withNone: ReleaseCache = cacheOf([[idOf(none), null]]);
		expect(calendarEntries([none, unknown], withNone, 'DE', RELEASE_KINDS, '2026-01-01')).toEqual(
			[]
		);
	});

	it('never gives a series the dates of the movie sharing its id', () => {
		const series = listed('Series', { mediaType: 'tv' });
		const shared: ReleaseCache = cacheOf([[idOf(series), { US: [['digital', '2027-01-01']] }]]);
		expect(calendarEntries([series], shared, 'US', RELEASE_KINDS, '2026-01-01')).toEqual([]);
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
		const entries = calendarEntries([later], cache, 'US', RELEASE_KINDS, '2026-11-01');
		expect(nextReleaseMonth(entries, '2026-12')).toBe('2027-03');
		expect(nextReleaseMonth(entries, '2027-03')).toBeNull();
	});
});

describe('monthGrid', () => {
	it('pads a month to whole Monday-first weeks and puts entries on their day', () => {
		const film = listed('Gridded');
		const cache: ReleaseCache = cacheOf([[idOf(film), { US: [['digital', '2026-12-18']] }]]);
		const entries = calendarEntries([film], cache, 'US', RELEASE_KINDS, '2026-12-01');
		const days = monthGrid('2026-12', entries);
		expect(days.length % 7).toBe(0);
		expect(days[0].date).toBeNull();
		expect(days[1].date).toBe('2026-12-01');
		expect(days.filter((d) => d.date).length).toBe(31);
		expect(days.find((d) => d.date === '2026-12-18')?.entries).toHaveLength(1);
	});
});

describe('compactReleases', () => {
	it('keeps theatrical, digital and physical dates once each, and drops undated countries', () => {
		const compact = compactReleases([
			{
				iso_3166_1: 'US',
				release_dates: [
					{ type: 1, release_date: '2026-09-01T00:00:00.000Z' },
					{ type: 3, release_date: '2026-12-18T00:00:00.000Z' },
					{ type: 3, release_date: '2026-12-18T00:00:00.000Z' },
					{ type: 4, release_date: '2027-02-01T00:00:00.000Z' },
					{ type: 6, release_date: '2027-06-01T00:00:00.000Z' }
				]
			},
			{ iso_3166_1: 'FR', release_dates: [{ type: 1, release_date: '2026-05-20T00:00:00.000Z' }] }
		]);
		expect(compact).toEqual({
			US: [
				['theatrical', '2026-12-18'],
				['digital', '2027-02-01']
			]
		});
	});
});
