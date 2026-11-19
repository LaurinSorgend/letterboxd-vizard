import { describe, expect, it } from 'vitest';
import { shiftDays } from '$lib/dates';
import { upcomingCandidates } from '$lib/releases/calendar';
import { tmdb } from '$lib/testing/fixtures';
import { RELEASE_KINDS, type WatchlistFilm } from '$lib/types';
import { discoverParams } from './discover';
import { compactReleases } from './releases';

describe('discoverParams', () => {
	it('asks for releases from today on, of films the calendar still treats as upcoming', () => {
		const today = '2026-11-14';
		const params = discoverParams('DE', 'theatrical', 2, today);
		expect(params['release_date.gte']).toBe(today);
		expect(params['release_date.lte'] > today).toBe(true);
		expect(params.page).toBe('2');
		expect(params.region).toBe('DE');

		// The oldest primary release discover asks for is exactly where the calendar stops keeping
		// a watchlist film as a candidate, so the two never disagree about what is upcoming.
		const oldest = params['primary_release_date.gte'];
		expect(oldest < today).toBe(true);
		const listed = (releaseDate: string): WatchlistFilm => ({
			uri: releaseDate,
			name: releaseDate,
			year: null,
			added: null,
			tmdb: tmdb({ releaseDate })
		});
		const kept = listed(oldest);
		const dropped = listed(shiftDays(oldest, -1));
		expect(upcomingCandidates([kept, dropped], today)).toEqual([kept.tmdb!.tmdbId]);
	});

	it('asks for the release types that read back as the same kind', () => {
		for (const kind of RELEASE_KINDS) {
			const types = discoverParams('US', kind, 1, '2026-11-14').with_release_type.split('|');
			const dates = types.map((type) => ({ type: Number(type), release_date: '2026-12-01' }));
			const read = compactReleases([{ iso_3166_1: 'US', release_dates: dates }]);
			expect(read.US.map(([of]) => of)).toEqual([kind]);
		}
	});

	it('adds with_people only when people are given', () => {
		expect(discoverParams('US', 'digital', 1, '2026-11-14')).not.toHaveProperty('with_people');
		expect(discoverParams('US', 'digital', 1, '2026-11-14', [])).not.toHaveProperty('with_people');
		expect(discoverParams('US', 'digital', 1, '2026-11-14', [1, 2]).with_people).toBe('1|2');
	});
});
