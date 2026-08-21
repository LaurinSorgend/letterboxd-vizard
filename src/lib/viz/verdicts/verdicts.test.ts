import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '$lib/wrapped/library';
import { verdictFor } from './index';
import { ORDER, rulesInOrder } from './rules';
import { buildTraits } from './traits';

/**
 * A distinct date per film, spread over all twelve months. No repeated date, so nothing here
 * reads as a double bill, and forty films, so nothing reads as a small evenly-paced year either:
 * the volume and rhythm labels all stay quiet and each fixture below tests what it says it does.
 */
const dateOf = (i: number, year: number, first: number) =>
	`${year}-${String((i % 12) + 1).padStart(2, '0')}-${String(Math.floor(i / 12) + first).padStart(2, '0')}`;

const COUNT = 40;

/**
 * Ratings spread across five steps and hearts on one film in five, so no rating label fires
 * either: a year rated all at one step is a Metronome, and one rated nowhere an Abstainer.
 * `KIND` lifts the average past The Generous without narrowing the spread.
 */
const QUIET = [2, 3, 3.5, 4, 5];
const KIND = [3.5, 4, 4.5, 5, 5];

const scored = (i: number, scale: number[]) => ({
	rating: scale[i % scale.length],
	liked: i % 5 === 0
});

const bulk = (count: number, over: Parameters<typeof film>[0] = {}, year = 2025, scale = QUIET) =>
	Array.from({ length: count }, (_, i) =>
		film({ ...watched([dateOf(i, year, 5)]), ...scored(i, scale), ...over })
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
		const films = bulk(COUNT, { tmdb: tmdb({ voteCount: 200 }) });
		expect(verdictFor(buildLibrary({ films, year: 2025 })).title).toBe('The Deep Diver');
	});

	it('keeps The Generous for a kind year', () => {
		const films = bulk(COUNT, { tmdb: tmdb({ voteCount: 6_000, year: 2020 }) }, 2025, KIND);
		expect(verdictFor(buildLibrary({ films, year: 2025 })).title).toBe('The Generous');
	});

	it('falls back to The Regular and cites the count', () => {
		const films = bulk(COUNT, { tmdb: tmdb({ voteCount: 6_000, year: 2020 }) });
		const verdict = verdictFor(buildLibrary({ films, year: 2025 }));
		expect(verdict.title).toBe('The Regular');
		expect(verdict.detail).toBe('40 films across 12 months of the year.');
	});
});

/**
 * Each fixture below satisfies every taste rule from its own position in the evaluation order
 * onward, and none before it, so a fixture that wins on rule N also proves rule N outranks every
 * taste rule listed after it. Chained across all seven fixtures, that pins their whole order —
 * not just the seven outcomes in isolation — the way the three tests above cannot on their own.
 * None of them fires a volume or rhythm label, so those never interpose.
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

	/**
	 * Quiet on every taste axis at once, not only the ones this section's own rules read:
	 * runtime sits between the Miniaturist and Marathoner thresholds, vote counts between the
	 * Deep Diver and Populist thresholds, countries spread across three so none dominates, and
	 * the release years spread across three decades so the median clears the Time Traveller's
	 * gap without clearing the Archivist's pre-1980 share or the Settler's single-decade share.
	 */
	function makeLibrary(toggles: Toggles) {
		const films = Array.from({ length: COUNT }, (_, i) =>
			film({
				...watched([dateOf(i, YEAR, 10)]),
				...scored(i, toggles.highRating ? KIND : QUIET),
				tmdb: tmdb({
					runtime: toggles.longRuntime ? 150 : 105,
					year: toggles.oldMedian ? [1985, 1995, 2000][i % 3] : 2020,
					countries: [toggles.manyCountries ? `C${i}` : ['US', 'GB', 'FR'][i % 3]],
					voteCount: toggles.obscure ? 200 : 5_000,
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
		expect(verdict.detail).toBe('Your median film came out in 1995.');
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
		expect(verdict.detail).toBe('You watched films from 40 countries.');
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
		expect(verdict.detail).toBe('You averaged ★ 4.40 across the year.');
	});

	it('falls back to Regular when nothing else matches', () => {
		const verdict = verdictFor(makeLibrary(ALL_FALSE));
		expect(verdict.title).toBe('The Regular');
		expect(verdict.detail).toBe('40 films across 12 months of the year.');
	});

	/**
	 * The integration-level twin of `neutralTraits`: a library that reads quiet on every trait
	 * this suite knows about should match nothing but the fallback. When a later section adds a
	 * rule that fires here too, this fails on a named interposing id instead of on a title string
	 * six tests away from the fixture that actually needs adjusting.
	 */
	it('the quiet library matches only the fallback', () => {
		const traits = buildTraits(makeLibrary(ALL_FALSE));
		const matched = rulesInOrder().filter((rule) => rule.when(traits));
		expect(matched.map((rule) => rule.id)).toEqual(['regular']);
	});
});
