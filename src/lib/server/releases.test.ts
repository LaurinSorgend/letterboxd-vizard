import { describe, expect, it } from 'vitest';
import { compactReleases } from './releases';

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
