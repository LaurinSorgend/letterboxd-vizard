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
	it('picks favourites by rating 4+ or like, and weights a liked unrated film as 1.5', () => {
		const profile = buildTasteProfile([
			fav({ directors: [person(1)] }, 3.5),
			fav({ directors: [person(2)] }, null, true)
		]);
		expect(profile.directors.has(1)).toBe(false);
		expect(profile.directors.get(2)).toBeCloseTo(1.5 / 3.5);
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
		expect(profile.keywords.get('heist')).toBeCloseTo(0.6);
	});
});

describe('scoreUpcoming', () => {
	it('drops a candidate sharing only the director of a single 4-star favourite', () => {
		const profile = buildTasteProfile([fav({ directors: [person(1)] })]);
		expect(scoreUpcoming(profile, [candidate({})], new Set())).toEqual([]);
	});

	it('keeps a candidate by the director of two 4-star favourites', () => {
		const profile = buildTasteProfile([
			fav({ directors: [person(1)] }),
			fav({ directors: [person(1)] })
		]);
		const [scored] = scoreUpcoming(profile, [candidate({})], new Set());
		expect(scored.score).toBeCloseTo(0.24);
		expect(scored.reason).toBe('Director Ada');
	});

	it('skips excluded ids and records with fewer than 3 cast', () => {
		const profile = { ...emptyProfile(), directors: new Map([[1, 1]]) };
		const excluded = candidate({});
		const thin = candidate({ cast: crew(501, 502) });
		const kept = candidate({});
		const result = scoreUpcoming(profile, [excluded, thin, kept], new Set([excluded.tmdbId]));
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
		const [scored] = scoreUpcoming(profile, [candidate(shared)], new Set());
		expect(scored.reason).toBe(
			'Director Ada · cast Bea, Cal · keywords: heist · same series as a favourite'
		);
	});
});

describe('topPeople', () => {
	it('lists the top 20 directors then the top 10 cast, deduped', () => {
		const range = (n: number, from: number) => Array.from({ length: n }, (_, i) => from + i);
		const profile: TasteProfile = {
			...emptyProfile(),
			directors: new Map(range(25, 1).map((id) => [id, id / 100])),
			cast: new Map([...range(12, 100).map((id) => [id, id / 1000] as [number, number]), [25, 1]])
		};
		const ids = topPeople(profile);
		expect(ids.slice(0, 20)).toEqual(range(20, 6).reverse());
		expect(ids.slice(20)).toEqual(range(9, 103).reverse());
		expect(ids).toHaveLength(29);
	});
});
