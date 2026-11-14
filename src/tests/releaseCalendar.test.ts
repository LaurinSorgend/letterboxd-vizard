import { describe, expect, it } from 'vitest';
import { calendarEntries, monthGrid, shiftMonth, upcomingCandidates } from '$lib/releases/calendar';
import { compactReleases, regionReleases } from '$lib/server/releases';
import { tmdb } from '$lib/testing/fixtures';
import type { ReleaseDate, WatchlistFilm } from '$lib/types';

function listed(name: string, over: Parameters<typeof tmdb>[0] = {}): WatchlistFilm {
	return { uri: `https://boxd.it/${name}`, name, year: null, added: null, tmdb: tmdb(over) };
}

describe('upcomingCandidates', () => {
	it('keeps undated and recent movies, drops old films and series', () => {
		const recent = listed('Recent', { releaseDate: '2026-01-10' });
		const undated = listed('Undated', { releaseDate: null });
		const old = listed('Old', { releaseDate: '2019-01-01' });
		const series = listed('Series', { releaseDate: null, mediaType: 'tv' });
		const ids = upcomingCandidates([recent, undated, old, series], '2026-11-14');
		expect(ids).toEqual([recent.tmdb!.tmdbId, undated.tmdb!.tmdbId]);
	});
});

describe('calendarEntries', () => {
	const a = listed('Alpha');
	const b = listed('Beta');
	const dates = new Map<number, ReleaseDate[]>([
		[
			a.tmdb!.tmdbId,
			[
				{ kind: 'theatrical', date: '2026-12-18', region: 'DE' },
				{ kind: 'digital', date: '2027-02-01', region: 'DE' },
				{ kind: 'physical', date: '2026-10-01', region: 'DE' }
			]
		],
		[b.tmdb!.tmdbId, [{ kind: 'physical', date: '2026-12-18', region: 'US' }]]
	]);
	const releasesOf = (id: number) => dates.get(id);

	it('shows all kinds from the start date on, by date then title', () => {
		const entries = calendarEntries(
			[b, a],
			releasesOf,
			['theatrical', 'digital', 'physical'],
			'2026-11-01'
		);
		expect(entries.map((e) => `${e.date} ${e.film.name} ${e.kind}`)).toEqual([
			'2026-12-18 Alpha theatrical',
			'2026-12-18 Beta physical',
			'2027-02-01 Alpha digital'
		]);
	});

	it('filters by release kind', () => {
		const entries = calendarEntries([a, b], releasesOf, ['digital'], '2026-11-01');
		expect(entries.map((e) => e.kind)).toEqual(['digital']);
	});
});

describe('monthGrid', () => {
	it('pads a month to whole Monday-first weeks', () => {
		const days = monthGrid('2026-12', []);
		expect(days.length % 7).toBe(0);
		expect(days[0].date).toBeNull();
		expect(days[1].date).toBe('2026-12-01');
		expect(days.filter((d) => d.date).length).toBe(31);
	});

	it('steps across year boundaries', () => {
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
	});
});

describe('release compaction', () => {
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

	it('keeps theatrical, digital and physical dates once each', () => {
		expect(compact).toEqual({
			US: [
				['theatrical', '2026-12-18'],
				['digital', '2027-02-01']
			]
		});
	});

	it('falls back to US dates for a country without any', () => {
		expect(regionReleases(compact, 'FR')[0]).toEqual({
			kind: 'theatrical',
			date: '2026-12-18',
			region: 'US'
		});
	});
});
