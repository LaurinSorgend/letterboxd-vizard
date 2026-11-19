import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '$lib/year/library';
import { posterRain } from './rain';
import type { EnrichedFilm } from '$lib/types';

const withPoster = (n: number) =>
	Array.from({ length: n }, (_, i) =>
		film({
			...watched([`2025-01-${String(i + 1).padStart(2, '0')}`]),
			tmdb: tmdb({ posterPath: `/p${i}.jpg` })
		})
	);

const rainOf = (films: EnrichedFilm[]) => posterRain(buildLibrary({ films, year: 2025 }));

/** Which of `withPoster`'s films a poster URL belongs to. */
const filmIndex = (url: string) => Number(url.match(/\/p(\d+)\.jpg$/)![1]);

describe('posterRain', () => {
	it('deals the posters round-robin, so a column is not one week of viewing', () => {
		const rain = rainOf(withPoster(20));
		const columns = rain.length;
		expect(columns).toBeGreaterThan(1);
		rain.forEach((column, c) => {
			expect(column.posters.map(filmIndex)).toEqual(
				column.posters.map((_, row) => c + row * columns)
			);
		});
	});

	it('skips films that never matched a poster', () => {
		const unmatched = film({ ...watched(['2025-02-02']), tmdb: null });
		const matched = withPoster(6);
		const dealt = rainOf([...matched, unmatched]).flatMap((column) => column.posters);
		expect(new Set(dealt)).toEqual(new Set(rainOf(matched).flatMap((column) => column.posters)));
	});

	it('deals in order of first watch, whatever order the export lists the films in', () => {
		const rain = rainOf(withPoster(20).reverse());
		expect(rain.map((column) => filmIndex(column.posters[0]))).toEqual(rain.map((_, c) => c));
	});

	it('falls back to nothing when the year has too few posters to fill the width', () => {
		const columns = rainOf(withPoster(20)).length;
		expect(rainOf(withPoster(columns - 1))).toEqual([]);
		const unmatched = film({ ...watched(['2025-02-02']), tmdb: null });
		expect(rainOf([...withPoster(columns - 1), unmatched])).toEqual([]);
		expect(rainOf(withPoster(columns))).toHaveLength(columns);
	});
});
