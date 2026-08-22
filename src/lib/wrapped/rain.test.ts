import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { posterRain } from './rain';

const withPoster = (n: number) =>
	Array.from({ length: n }, (_, i) =>
		film({ ...watched(['2025-01-01']), tmdb: tmdb({ posterPath: `/p${i}.jpg` }) })
	);

describe('posterRain', () => {
	it('deals the posters round-robin, so a column is not one week of viewing', () => {
		const rain = posterRain(withPoster(20));
		expect(rain).toHaveLength(5);
		expect(rain[0].posters).toEqual([
			'https://image.tmdb.org/t/p/w185/p0.jpg',
			'https://image.tmdb.org/t/p/w185/p5.jpg',
			'https://image.tmdb.org/t/p/w185/p10.jpg',
			'https://image.tmdb.org/t/p/w185/p15.jpg'
		]);
		expect(rain[1].posters[0]).toBe('https://image.tmdb.org/t/p/w185/p1.jpg');
	});

	it('gives every column its own speed', () => {
		const speeds = posterRain(withPoster(20)).map((column) => column.speed);
		expect(new Set(speeds).size).toBe(speeds.length);
	});

	it('skips films that never matched a poster', () => {
		const films = [...withPoster(6), film({ ...watched(['2025-02-02']), tmdb: null })];
		for (const column of posterRain(films)) {
			expect(column.posters.every((url) => url.includes('/p'))).toBe(true);
		}
	});

	it('falls back to nothing when the year has too few posters to fill the width', () => {
		expect(posterRain(withPoster(4))).toEqual([]);
	});
});
