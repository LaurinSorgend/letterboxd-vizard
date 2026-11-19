import { describe, expect, it } from 'vitest';
import { film, omdb, tmdb, watched } from '$lib/testing/fixtures';
import { deepCutScene, genreScene } from './core';
import { deckOf } from '$lib/testing/year';
import { assemble, buildDeck } from '../deck';
import type { Scene } from './shared';

/** Every frame the year earned, gate and extras included. */
const buildScenes = (data: ReturnType<typeof deckOf>): Scene[] => assemble(buildDeck(data), true);

const films = Array.from({ length: 12 }, (_, i) =>
	film({
		...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]),
		rating: 3.5,
		tmdb: tmdb({ genres: ['Drama'], runtime: 110, countries: ['FR'] })
	})
);

describe('buildScenes', () => {
	it('never emits a scene with an empty value', () => {
		for (const scene of buildScenes(deckOf(films, 2025))) {
			expect(scene.value.length).toBeGreaterThan(0);
			expect(scene.label.length).toBeGreaterThan(0);
		}
	});

	/* The binding rule is that a frame whose data fails its condition disappears rather than
	   rendering a dash or a zero. Three frames broke it and were caught only by review, so the
	   deck now asserts it in one place. Stats rows are tables and are out of scope. */
	it('never states a zero or a dash in a headline or in note prose', () => {
		const sparse = [
			...Array.from({ length: 12 }, (_, i) =>
				film({ ...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]), rating: 3.5 })
			),
			...Array.from({ length: 3 }, () => film(watched(['2019-01-01'])))
		];
		for (const data of [deckOf(films, 2025), deckOf(sparse, 2025)]) {
			for (const scene of buildScenes(data)) {
				const prose = `${scene.value} ${scene.note} ${scene.footnote ?? ''}`;
				expect(prose, `${scene.id} headline or note`).not.toMatch(/—/);
				expect(prose, `${scene.id} headline or note`).not.toMatch(/(^|[^\d,.])0([^\d.%]|$)/);
			}
		}
	});

	it('leads the genre frame on the most-watched genre, with its own count and average', () => {
		const genre = (name: string, count: number, rating: number) =>
			Array.from({ length: count }, (_, i) =>
				film({ ...watched([`2025-0${(i % 9) + 1}-10`]), rating, tmdb: tmdb({ genres: [name] }) })
			);
		const scene = genreScene(deckOf([...genre('Horror', 4, 2), ...genre('Drama', 8, 3.5)], 2025));
		expect(scene?.value).toBe('Drama');
		expect(scene?.note).toBe('8 films, averaging ★ 3.5.');
		expect(scene?.body.kind === 'bars' && scene.body.bars.map((bar) => bar.label)).toEqual([
			'Drama',
			'Horror'
		]);
	});

	it('does not double the s in "films" when a director has more than one film this year', () => {
		const director = { name: 'Sidney Lumet', tmdbId: 1, profilePath: null };
		const localFilms = Array.from({ length: 10 }, (_, i) =>
			film({
				...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]),
				rating: 3.5,
				tmdb: tmdb({ genres: ['Drama'], directors: i < 2 ? [director] : [], countries: ['FR'] })
			})
		);
		const data = deckOf(localFilms, 2025);
		const directorScene = buildScenes(data).find((scene) => scene.id === 'director');
		expect(directorScene?.note).toBe('2 of their films this year, averaging ★ 3.5.');
	});

	it('does not double the s in "films" when an actor is billed in more than one film this year', () => {
		const actor = { name: 'Alan Tudyk', tmdbId: 2, profilePath: null };
		const localFilms = Array.from({ length: 10 }, (_, i) =>
			film({
				...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]),
				rating: 3.5,
				tmdb: tmdb({ genres: ['Drama'], cast: i < 2 ? [actor] : [], countries: ['FR'] })
			})
		);
		const data = deckOf(localFilms, 2025);
		const actorScene = buildScenes(data).find((scene) => scene.id === 'actor');
		expect(actorScene?.note).toBe('Billed in 2 of your films.');
	});

	it('takes the deepest cut from the films anyone has voted on, and quotes the same count', () => {
		const voted = (voteCount: number, imdbVotes: number | null = null) =>
			film({
				...watched(['2025-03-01']),
				tmdb: tmdb({ voteCount }),
				omdb: omdb({ imdbVotes })
			});
		const unvoted = voted(0);
		const deep = voted(40, 60);
		const shallow = voted(300);
		const scene = deepCutScene(deckOf([unvoted, deep, shallow, ...films], 2025));
		expect(scene?.value).toBe(deep.name);
		expect(scene?.note).toBe('100 ratings across TMDB and IMDb. You were one of them.');
	});

	it('drops the deepest cut when no film has votes to cite', () => {
		const silent = films.map((entry) => ({ ...entry, tmdb: tmdb({ voteCount: 0 }) }));
		expect(deepCutScene(deckOf(silent, 2025))).toBeNull();
	});
});
