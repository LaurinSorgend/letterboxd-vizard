import { describe, expect, it } from 'vitest';
import { film, omdb, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '$lib/wrapped/library';
import { buildTraits } from './traits';

const person = (id: number, name = `Person ${id}`) => ({ name, tmdbId: id, profilePath: null });

const year2025 = Array.from({ length: 20 }, (_, i) =>
	film({
		...watched([`2025-${String((i % 12) + 1).padStart(2, '0')}-05`], 4),
		rating: 4,
		liked: i < 12,
		review: i < 4 ? 'some words here' : null,
		tags: i < 10 ? ['cinema'] : [],
		tmdb: tmdb({
			runtime: 90,
			genres: i < 12 ? ['Horror'] : ['Drama'],
			countries: ['KR'],
			originalLanguage: i < 15 ? 'ko' : 'en',
			voteCount: i < 5 ? 400 : 30_000,
			mediaType: i < 3 ? 'tv' : 'movie',
			releaseDate: '1979-05-13',
			year: 1979,
			directors: [person(1, 'Bong Joon-ho')],
			cast: [person(9, 'Song Kang-ho')]
		}),
		omdb: omdb({ metascore: 80 })
	})
);
const year2024 = Array.from({ length: 18 }, (_, i) =>
	film(watched([`2024-0${(i % 9) + 1}-01`], 3))
);

const traits = buildTraits(
	buildLibrary({
		films: [...year2025, ...year2024],
		year: 2025,
		locale: 'en-GB',
		watchlist: Array.from({ length: 110 }, (_, i) => ({
			uri: `w${i}`,
			name: `Queued ${i}`,
			year: 2000,
			added: '2019-01-01'
		})),
		now: new Date('2026-01-15T00:00:00Z')
	})
);

describe('buildTraits', () => {
	it('measures volume and rhythm', () => {
		expect(traits.films).toBe(20);
		expect(traits.entries).toBe(20);
		expect(traits.activeMonths).toBe(12);
		expect(traits.previousYearFilms).toBe(18);
		expect(traits.loggedBeforePreviousYear).toBe(false);
	});

	it('measures rating behaviour', () => {
		expect(traits.rated).toBe(20);
		expect(traits.ratedShare).toBe(1);
		expect(traits.meanRating).toBe(4);
		expect(traits.fiveStarShare).toBe(0);
		expect(traits.pairShare).toBe(1);
		expect(traits.likedShare).toBeCloseTo(0.6);
		expect(traits.metascoreMean).toBe(80);
	});

	it('measures taste and range', () => {
		expect(traits.preEightiesShare).toBe(1);
		expect(traits.topGenre).toBe('Horror');
		expect(traits.topGenreShare).toBeCloseTo(0.6);
		expect(traits.topCountry).toBe('KR');
		expect(traits.topCountryShare).toBe(1);
		// Fifteen of twenty in Korean makes Korean this viewer's language, so the five English
		// films are the foreign ones — the en-GB locale on the fixture does not decide it.
		expect(traits.foreignShare).toBeCloseTo(0.25);
		expect(traits.televisionShare).toBeCloseTo(0.15);
		expect(traits.meanRuntime).toBe(90);
	});

	it('measures attachment and habit', () => {
		expect(traits.topDirector).toEqual({ name: 'Bong Joon-ho', count: 20 });
		expect(traits.topCastMember).toEqual({ name: 'Song Kang-ho', count: 20 });
		expect(traits.reviewShare).toBeCloseTo(0.2);
		expect(traits.tagShare).toBeCloseTo(0.5);
		expect(traits.watchlistSize).toBe(110);
		expect(traits.watchlistRatio).toBeCloseTo(5.5);
	});

	it('counts a rewatch from the entry that was one, not from a flag set anywhere in the export', () => {
		// Watched once in 2025 and returned to in 2026. `film.rewatch` is true for the whole
		// export, so a per-film flag would score the 2025 first watch as a return visit.
		const later = film({ ...watched(['2025-06-01', '2026-06-01']), rewatch: true });
		const rest = Array.from({ length: 19 }, (_, i) => film(watched([`2025-01-${10 + i}`])));
		const only2025 = buildTraits(buildLibrary({ films: [later, ...rest], year: 2025 }));
		expect(only2025.rewatchShare).toBe(0);

		// The same film in 2026, where the second viewing genuinely is the rewatch.
		const in2026 = Array.from({ length: 19 }, (_, i) => film(watched([`2026-01-${10 + i}`])));
		const next = buildTraits(buildLibrary({ films: [later, ...in2026], year: 2026 }));
		expect(next.rewatchShare).toBeCloseTo(1 / 20);
	});
});
