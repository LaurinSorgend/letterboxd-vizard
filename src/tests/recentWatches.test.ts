import { describe, expect, it } from 'vitest';
import { recentWatches } from '$lib/viz/stats';
import { film, watched } from '$lib/testing/fixtures';

describe('recentWatches', () => {
	it('orders films by their latest diary entry, newest first', () => {
		const older = film({ name: 'Older', ...watched(['2026-01-01']) });
		const newer = film({ name: 'Newer', ...watched(['2026-03-01']) });
		expect(recentWatches([older, newer]).map((w) => w.film.name)).toEqual(['Newer', 'Older']);
	});

	it('shows a rewatched film once, at its latest watch, whatever order the diary is in', () => {
		const rewatched = film(watched(['2026-05-01', '2024-01-01']));
		expect(recentWatches([rewatched])).toEqual([
			{ film: rewatched, date: '2026-05-01', rating: null }
		]);
	});

	it('falls back to the film rating when the entry has none', () => {
		const rated = film({ rating: 4, ...watched(['2026-05-01']) });
		expect(recentWatches([rated])[0].rating).toBe(4);
	});

	it('leaves out films with no diary entry and respects the limit', () => {
		const logged = ['2026-01-01', '2026-01-02', '2026-01-03'].map((date) => film(watched([date])));
		expect(recentWatches([film(), ...logged], 2).map((w) => w.date)).toEqual([
			'2026-01-03',
			'2026-01-02'
		]);
	});
});
