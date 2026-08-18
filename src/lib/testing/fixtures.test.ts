import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from './fixtures';

describe('fixtures', () => {
	it('gives every film a distinct uri and name', () => {
		expect(film().uri).not.toBe(film().uri);
		expect(film().name).not.toBe(film().name);
	});

	it('takes overrides without losing the defaults', () => {
		const one = film({ rating: 4.5, tmdb: tmdb({ runtime: 90 }) });
		expect(one.rating).toBe(4.5);
		expect(one.tmdb?.runtime).toBe(90);
		expect(one.tmdb?.genres).toEqual([]);
		expect(one.liked).toBe(false);
	});

	it('keeps watchedDates and entries in step', () => {
		const one = film(watched(['2025-01-02', '2025-03-04'], 3));
		expect(one.watchedDates).toEqual(['2025-01-02', '2025-03-04']);
		expect(one.entries.map((entry) => entry.rating)).toEqual([3, 3]);
	});
});
