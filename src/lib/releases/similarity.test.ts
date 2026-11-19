import { describe, expect, it } from 'vitest';
import { film, tmdb } from '$lib/testing/fixtures';
import type { EnrichedFilm, Person, TmdbMovie } from '$lib/types';
import { buildTasteProfile, scoreUpcoming, topPeople, type TasteProfile } from './similarity';

const person = (tmdbId: number, name = `Person ${tmdbId}`): Person => ({
	name,
	tmdbId,
	profilePath: null
});

const crew = (...ids: number[]): Person[] => ids.map((id) => person(id));

const fav = (over: Partial<TmdbMovie>, rating: number | null = 4, liked = false): EnrichedFilm =>
	film({ rating, liked, tmdb: tmdb(over) });

const filler = (count: number): EnrichedFilm[] =>
	Array.from({ length: count }, () => film({ rating: 2, tmdb: tmdb() }));

const candidate = (over: Partial<TmdbMovie>): TmdbMovie =>
	tmdb({ directors: [person(1, 'Ada')], cast: crew(501, 502, 503), ...over });

const emptyProfile = (): TasteProfile => ({
	directors: new Map(),
	cast: new Map(),
	keywords: new Map(),
	collections: new Set()
});

describe('buildTasteProfile', () => {
	it('picks favourites by rating 4+ or a heart, counting a hearted unrated film as a 4', () => {
		const profile = buildTasteProfile([
			fav({ directors: [person(1)] }, 3.5),
			fav({ directors: [person(2)] }, null, true)
		]);
		expect(profile.directors.has(1)).toBe(false);
		const fourStar = buildTasteProfile([fav({ directors: [person(2)] }, 4)]);
		expect(profile.directors.get(2)).toBeCloseTo(fourStar.directors.get(2)!);
	});

	it('weighs a higher rating and a second favourite more', () => {
		const affinity = (films: EnrichedFilm[]) => buildTasteProfile(films).directors.get(1)!;
		const four = affinity([fav({ directors: [person(1)] }, 4)]);
		expect(affinity([fav({ directors: [person(1)] }, 5)])).toBeGreaterThan(four);
		expect(
			affinity([fav({ directors: [person(1)] }, 4), fav({ directors: [person(1)] }, 4)])
		).toBeGreaterThan(four);
	});

	it('ignores cast seen in only one favourite', () => {
		const profile = buildTasteProfile([fav({ cast: crew(10, 11) }), fav({ cast: crew(10, 12) })]);
		expect([...profile.cast.keys()]).toEqual([10]);
	});

	it('ignores keywords present in more than 10% of the library', () => {
		const profile = buildTasteProfile([
			fav({ keywords: ['heist', 'love'] }),
			fav({ keywords: ['heist', 'love'] }),
			film({ rating: 2, tmdb: tmdb({ keywords: ['love'] }) }),
			...filler(17)
		]);
		expect([...profile.keywords.keys()]).toEqual(['heist']);
	});
});

describe('scoreUpcoming', () => {
	it('keeps a candidate sharing only the director of a single 4-star favourite', () => {
		const profile = buildTasteProfile([fav({ directors: [person(1)] })]);
		expect(scoreUpcoming(profile, [candidate({})]).map((s) => s.reason)).toEqual(['Director Ada']);
	});

	it('drops a candidate sharing only the director of a liked 2-star film', () => {
		const profile = buildTasteProfile([
			{ ...fav({ directors: [person(1)] }), rating: 2, liked: true }
		]);
		expect(scoreUpcoming(profile, [candidate({})])).toEqual([]);
	});

	it('ranks a director of two favourites above a director of one', () => {
		const profile = buildTasteProfile([
			fav({ directors: [person(1)] }),
			fav({ directors: [person(1)] }),
			fav({ directors: [person(2)] })
		]);
		const once = candidate({ directors: [person(2, 'Bo')] });
		const twice = candidate({});
		const scored = scoreUpcoming(profile, [once, twice]);
		expect(scored.map((s) => s.record)).toEqual([twice, once]);
		expect(scored[0].reason).toBe('Director Ada');
	});

	it('ranks a candidate sharing more with the favourites higher', () => {
		const shared = { directors: [person(1, 'Ada')], keywords: ['heist'] };
		const profile = buildTasteProfile([fav(shared), fav(shared), ...filler(18)]);
		const directorOnly = candidate({});
		const directorAndKeyword = candidate({ keywords: ['heist'] });
		const scored = scoreUpcoming(profile, [directorOnly, directorAndKeyword]);
		expect(scored.map((s) => s.record)).toEqual([directorAndKeyword, directorOnly]);
	});

	it('skips records with fewer than 3 cast', () => {
		const profile = { ...emptyProfile(), directors: new Map([[1, 1]]) };
		const thin = candidate({ cast: crew(501, 502) });
		const kept = candidate({});
		const result = scoreUpcoming(profile, [thin, kept]);
		expect(result.map((s) => s.record.tmdbId)).toEqual([kept.tmdbId]);
	});

	it('explains the match by director, cast, keywords and series', () => {
		const shared = {
			directors: [person(1, 'Ada')],
			cast: [person(501, 'Bea'), person(502, 'Cal'), person(503, 'Dot')],
			keywords: ['heist'],
			collection: { id: 77, name: 'Saga', posterPath: null }
		};
		const profile = buildTasteProfile([fav(shared), fav(shared), ...filler(18)]);
		const [scored] = scoreUpcoming(profile, [candidate(shared)]);
		expect(scored.reason).toBe(
			'Director Ada · cast Bea, Cal · keywords: heist · same series as a favourite'
		);
	});
});

describe('topPeople', () => {
	it('lists the strongest directors, then the strongest cast, once each, and drops the weakest', () => {
		const range = (n: number, from: number) => Array.from({ length: n }, (_, i) => from + i);
		const directors = new Map(range(200, 1).map((id) => [id, id / 1000] as [number, number]));
		const cast = new Map(range(200, 1001).map((id) => [id, id / 10_000] as [number, number]));
		cast.set(200, 1);
		const ids = topPeople({ ...emptyProfile(), directors, cast });

		expect(new Set(ids).size).toBe(ids.length);
		const listedDirectors = ids.filter((id) => directors.has(id));
		const listedCast = ids.filter((id) => !directors.has(id));
		expect(ids).toEqual([...listedDirectors, ...listedCast]);
		for (const [listed, all] of [
			[listedDirectors, directors],
			[listedCast, cast]
		] as const) {
			expect(listed.length).toBeGreaterThan(0);
			expect(listed.length).toBeLessThan(all.size);
			const weights = listed.map((id) => all.get(id)!);
			expect(weights).toEqual([...weights].sort((a, b) => b - a));
			const weakestListed = Math.min(...weights);
			for (const [id, weight] of all) {
				if (!listed.includes(id) && !ids.includes(id))
					expect(weight).toBeLessThanOrEqual(weakestListed);
			}
		}
	});
});
