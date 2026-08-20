import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '$lib/wrapped/library';
import { verdictFor } from './index';
import { ORDER, rulesInOrder } from './rules';

const bulk = (count: number, over: Parameters<typeof film>[0] = {}, year = 2025) =>
	Array.from({ length: count }, (_, i) =>
		film({ ...watched([`${year}-${String((i % 12) + 1).padStart(2, '0')}-05`]), ...over })
	);

describe('rulesInOrder', () => {
	it('lists every implemented rule exactly once, in the declared order', () => {
		const ids = rulesInOrder().map((rule) => rule.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual(ORDER.filter((id) => ids.includes(id)));
	});

	it('ends on the fallback, which always matches', () => {
		const last = rulesInOrder().at(-1);
		expect(last?.id).toBe('regular');
	});
});

describe('verdictFor', () => {
	it('keeps The Deep Diver for an obscure year', () => {
		const films = bulk(20, { tmdb: tmdb({ voteCount: 200 }) });
		expect(verdictFor(buildLibrary({ films, year: 2025 })).title).toBe('The Deep Diver');
	});

	it('keeps The Generous for a kind year', () => {
		const films = bulk(20, { rating: 4.5, tmdb: tmdb({ voteCount: 50_000, year: 2020 }) });
		expect(verdictFor(buildLibrary({ films, year: 2025 })).title).toBe('The Generous');
	});

	it('falls back to The Regular and cites the count', () => {
		const films = bulk(12, { rating: 3, tmdb: tmdb({ voteCount: 6_000, year: 2020 }) });
		const verdict = verdictFor(buildLibrary({ films, year: 2025 }));
		expect(verdict.title).toBe('The Regular');
		expect(verdict.detail).toContain('12');
	});
});

/**
 * Each fixture below satisfies every implemented rule from its own position in the evaluation
 * order onward, and none before it, so a fixture that wins on rule N also proves rule N outranks
 * every rule listed after it. Chained across all seven fixtures, that pins the whole order — not
 * just the seven outcomes in isolation — the way the three tests above cannot on their own.
 */
describe('verdictFor rule order', () => {
	const YEAR = 2025;
	const DIRECTOR = { name: 'Auteur One', tmdbId: 777, profilePath: null };

	interface Toggles {
		obscure: boolean;
		oldMedian: boolean;
		manyCountries: boolean;
		longRuntime: boolean;
		loyalDirector: boolean;
		highRating: boolean;
	}

	const ALL_FALSE: Toggles = {
		obscure: false,
		oldMedian: false,
		manyCountries: false,
		longRuntime: false,
		loyalDirector: false,
		highRating: false
	};

	function makeLibrary(toggles: Toggles) {
		const films = Array.from({ length: 20 }, (_, i) =>
			film({
				...watched([`${YEAR}-${String((i % 12) + 1).padStart(2, '0')}-10`]),
				rating: toggles.highRating ? 4 : 3,
				tmdb: tmdb({
					runtime: toggles.longRuntime ? 150 : 90,
					year: toggles.oldMedian ? 1970 : 2020,
					countries: [toggles.manyCountries ? `C${i}` : 'US'],
					voteCount: toggles.obscure ? 200 : 50_000,
					directors: toggles.loyalDirector && i < 6 ? [DIRECTOR] : []
				})
			})
		);
		return buildLibrary({ films, year: YEAR });
	}

	it('picks Deep Diver when every rule from 1 onward matches', () => {
		const verdict = verdictFor(
			makeLibrary({
				obscure: true,
				oldMedian: true,
				manyCountries: true,
				longRuntime: true,
				loyalDirector: true,
				highRating: true
			})
		);
		expect(verdict.title).toBe('The Deep Diver');
	});

	it('picks Time Traveller when 2 onward matches but not 1', () => {
		const verdict = verdictFor(
			makeLibrary({
				...ALL_FALSE,
				oldMedian: true,
				manyCountries: true,
				longRuntime: true,
				loyalDirector: true,
				highRating: true
			})
		);
		expect(verdict.title).toBe('The Time Traveller');
		expect(verdict.detail).toBe('Your median film came out in 1970.');
	});

	it('picks Globetrotter when 3 onward matches but not 1-2', () => {
		const verdict = verdictFor(
			makeLibrary({
				...ALL_FALSE,
				manyCountries: true,
				longRuntime: true,
				loyalDirector: true,
				highRating: true
			})
		);
		expect(verdict.title).toBe('The Globetrotter');
		expect(verdict.detail).toBe('You watched films from 20 countries.');
	});

	it('picks Marathoner when 4 onward matches but not 1-3', () => {
		const verdict = verdictFor(
			makeLibrary({ ...ALL_FALSE, longRuntime: true, loyalDirector: true, highRating: true })
		);
		expect(verdict.title).toBe('The Marathoner');
		expect(verdict.detail).toBe('Your average film ran 150 minutes.');
	});

	it('picks Completist when 5 onward matches but not 1-4', () => {
		const verdict = verdictFor(
			makeLibrary({ ...ALL_FALSE, loyalDirector: true, highRating: true })
		);
		expect(verdict.title).toBe('The Completist');
		expect(verdict.detail).toBe('You watched 6 films by Auteur One.');
	});

	it('picks Generous when only 6 matches', () => {
		const verdict = verdictFor(makeLibrary({ ...ALL_FALSE, highRating: true }));
		expect(verdict.title).toBe('The Generous');
		expect(verdict.detail).toBe('You averaged ★ 4.00 across the year.');
	});

	it('falls back to Regular when nothing else matches', () => {
		const verdict = verdictFor(makeLibrary(ALL_FALSE));
		expect(verdict.title).toBe('The Regular');
		expect(verdict.detail).toBe('20 films across 12 months of the year.');
	});
});
