import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from './wrapped';
import { assemble, buildDeck, DECK_CAP } from './deck';

/** A heavy year: enough of everything that most frames survive their drop-out conditions. */
const heavy = Array.from({ length: 120 }, (_, i) =>
	film({
		...watched(
			[`2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`],
			4
		),
		rating: i % 25 === 0 ? 5 : 4,
		liked: i % 3 === 0,
		review: i % 10 === 0 ? 'a few words about it' : null,
		tags: i % 4 === 0 ? ['cinema'] : [],
		tmdb: tmdb({
			runtime: 100,
			genres: ['Drama'],
			countries: ['FR'],
			originalLanguage: i % 2 === 0 ? 'fr' : 'en',
			voteCount: (i + 1) * 300,
			releaseDate: i < 10 ? '2025-02-01' : '1979-05-13',
			year: i < 10 ? 2025 : 1979
		})
	})
);
const thin = Array.from({ length: 11 }, (_, i) => film(watched([`2025-03-${10 + i}`])));

describe('buildDeck', () => {
	it('caps the main run and holds the overflow back', () => {
		const deck = buildDeck(buildWrapped(heavy, 2025)!);
		expect(deck.main.length).toBeLessThanOrEqual(DECK_CAP);
		expect(deck.extras.length).toBeGreaterThan(0);
		expect(deck.closing.map((scene) => scene.id)).toEqual(['verdict', 'summary']);
	});

	it('always opens on the title and the count', () => {
		const deck = buildDeck(buildWrapped(heavy, 2025)!);
		expect(deck.main.slice(0, 2).map((scene) => scene.id)).toEqual(['title', 'count']);
	});

	it('gives a thin year a short deck with nothing held back', () => {
		const deck = buildDeck(buildWrapped(thin, 2025)!);
		expect(deck.main.length).toBeLessThan(DECK_CAP);
		expect(deck.extras).toEqual([]);
	});

	it('never repeats a frame between the main run and the extras', () => {
		const deck = buildDeck(buildWrapped(heavy, 2025)!);
		const ids = [...deck.main, ...deck.extras, ...deck.closing].map((scene) => scene.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('assemble', () => {
	it('puts a gate frame between the main run and the closing pair', () => {
		const deck = buildDeck(buildWrapped(heavy, 2025)!);
		const collapsed = assemble(deck, false).map((scene) => scene.id);
		expect(collapsed).toHaveLength(deck.main.length + 3);
		expect(collapsed.at(-3)).toBe('more');
		expect(collapsed.at(-1)).toBe('summary');
	});

	it('splices the extras in at the gate when expanded, keeping earlier indices stable', () => {
		const deck = buildDeck(buildWrapped(heavy, 2025)!);
		const collapsed = assemble(deck, false);
		const expanded = assemble(deck, true);
		expect(expanded).toHaveLength(collapsed.length + deck.extras.length);
		expect(expanded.slice(0, deck.main.length).map((s) => s.id)).toEqual(
			collapsed.slice(0, deck.main.length).map((s) => s.id)
		);
	});

	it('omits the gate entirely when nothing was held back', () => {
		const deck = buildDeck(buildWrapped(thin, 2025)!);
		expect(assemble(deck, false).map((scene) => scene.id)).not.toContain('more');
	});
});
