import { describe, expect, it } from 'vitest';
import { recentWatches } from './stats';
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

	it('leaves out films with no diary entry and keeps the ten latest', () => {
		const logged = Array.from({ length: 12 }, (_, i) =>
			film(watched([`2026-01-${String(i + 1).padStart(2, '0')}`]))
		);
		const recent = recentWatches([film(), ...logged]);
		expect(recent).toHaveLength(10);
		expect(recent[0].date).toBe('2026-01-12');
		expect(recent.at(-1)!.date).toBe('2026-01-03');
	});
});
