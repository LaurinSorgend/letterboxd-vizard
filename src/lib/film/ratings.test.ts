import { describe, expect, it } from 'vitest';
import { film, omdb, tmdb } from '$lib/testing/fixtures';
import { extremes, gapsTo, IMDB, METACRITIC, SOURCES, TMDB, YOURS } from './ratings';

describe('rating sources', () => {
	it('puts every source on one 0-100 scale', () => {
		const f = film({
			rating: 4,
			tmdb: tmdb({ voteAverage: 7.5 }),
			omdb: omdb({ imdbRating: 8, rottenTomatoes: 90, metascore: 70 })
		});
		expect(SOURCES.map((source) => source.of(f))).toEqual([80, 75, 80, 90, 70]);
	});

	it('reads a TMDB score of 0 as no score', () => {
		expect(TMDB.of(film({ tmdb: tmdb({ voteAverage: 0 }) }))).toBeNull();
	});

	it('reads a missing rating as null, not as zero', () => {
		const f = film({ rating: null, omdb: omdb({ imdbRating: 0 }) });
		expect(YOURS.of(f)).toBeNull();
		expect(IMDB.of(f)).toBe(0);
		expect(METACRITIC.of(f)).toBeNull();
	});
});

describe('gapsTo', () => {
	it('keeps only films both you and the source rated', () => {
		const rated = film({ rating: 3, omdb: omdb({ metascore: 80 }) });
		const unrated = film({ rating: null, omdb: omdb({ metascore: 50 }) });
		const unscored = film({ rating: 5 });
		expect(gapsTo([rated, unrated, unscored], METACRITIC)).toEqual([
			{ film: rated, yours: 60, source: 80, gap: -20 }
		]);
	});
});

describe('extremes', () => {
	const gaps = [5, -1, 3, 0, -4, 2].map((gap) => ({ gap }));

	it('lists the widest gaps each way, widest first', () => {
		expect(extremes(gaps, 2)).toEqual({
			over: [{ gap: 5 }, { gap: 3 }],
			under: [{ gap: -4 }, { gap: -1 }]
		});
	});

	it('never lists a film on the wrong side', () => {
		const { over, under } = extremes([{ gap: 1 }, { gap: 2 }], 5);
		expect(over).toHaveLength(2);
		expect(under).toEqual([]);
	});
});
