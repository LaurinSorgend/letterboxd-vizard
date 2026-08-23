import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from '../wrapped';
import { assemble, buildDeck } from '../deck';
import type { Scene, Accent } from './shared';
import type { Wrapped } from '../wrapped';

/** Every frame the year earned, gate and extras included. */
const buildScenes = (data: Wrapped): Scene[] => assemble(buildDeck(data), true);

const HUES: Accent[] = [
	'neutral',
	'amber',
	'oxblood',
	'cyan',
	'indigo',
	'forest',
	'magenta',
	'gold'
];

const films = Array.from({ length: 12 }, (_, i) =>
	film({
		...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]),
		rating: 3.5,
		tmdb: tmdb({ genres: ['Drama'], runtime: 110, countries: ['FR'] })
	})
);

describe('buildScenes', () => {
	it('renders the full scene sequence, in order, each with its hue and body shape', () => {
		const data = buildWrapped(films, 2025);
		const shape = buildScenes(data!).map((scene) => ({
			id: scene.id,
			accent: scene.accent,
			bodyKind: scene.body.kind
		}));
		expect(shape).toEqual([
			{ id: 'title', accent: 'neutral', bodyKind: 'none' },
			{ id: 'count', accent: 'amber', bodyKind: 'none' },
			{ id: 'hours', accent: 'gold', bodyKind: 'none' },
			{ id: 'months', accent: 'cyan', bodyKind: 'bars' },
			{ id: 'streak', accent: 'cyan', bodyKind: 'posters' },
			{ id: 'silence', accent: 'indigo', bodyKind: 'none' },
			{ id: 'doubles', accent: 'gold', bodyKind: 'none' },
			{ id: 'top', accent: 'oxblood', bodyKind: 'posters' },
			{ id: 'genre', accent: 'forest', bodyKind: 'bars' },
			{ id: 'reach', accent: 'cyan', bodyKind: 'bars' },
			{ id: 'era', accent: 'gold', bodyKind: 'posters' },
			{ id: 'wait', accent: 'oxblood', bodyKind: 'posters' },
			{ id: 'longest', accent: 'amber', bodyKind: 'posters' },
			{ id: 'deep-cut', accent: 'magenta', bodyKind: 'posters' },
			{ id: 'verdict', accent: 'oxblood', bodyKind: 'none' },
			{ id: 'summary', accent: 'neutral', bodyKind: 'summary' }
		]);
	});

	it('keeps every accent within the eight defined hues', () => {
		for (const scene of buildScenes(buildWrapped(films, 2025)!)) {
			expect(HUES).toContain(scene.accent);
		}
	});

	it('never emits a scene with an empty value', () => {
		for (const scene of buildScenes(buildWrapped(films, 2025)!)) {
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
		for (const data of [buildWrapped(films, 2025)!, buildWrapped(sparse, 2025)!]) {
			for (const scene of buildScenes(data)) {
				const prose = `${scene.value} ${scene.note} ${scene.footnote ?? ''}`;
				expect(prose, `${scene.id} headline or note`).not.toMatch(/—/);
				expect(prose, `${scene.id} headline or note`).not.toMatch(/(^|[^\d,.])0([^\d.%]|$)/);
			}
		}
	});

	it('pins the genre scene exactly, since its content does not depend on fixture identity', () => {
		const data = buildWrapped(films, 2025);
		const genreScene = buildScenes(data!).find((scene) => scene.id === 'genre');
		expect(genreScene).toEqual({
			id: 'genre',
			accent: 'forest',
			label: 'Genre of the year',
			value: 'Drama',
			valueKind: 'name',
			note: '12 films, averaging ★ 3.5. A film counts once per genre it carries.',
			stats: [],
			body: { kind: 'bars', bars: [{ label: 'Drama', value: '12', share: 1 }] }
		});
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
		const data = buildWrapped(localFilms, 2025);
		const directorScene = buildScenes(data!).find((scene) => scene.id === 'director');
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
		const data = buildWrapped(localFilms, 2025);
		const actorScene = buildScenes(data!).find((scene) => scene.id === 'actor');
		expect(actorScene?.note).toBe('Billed in 2 of your films.');
	});

	it('drops the deepest cut entirely when it has no votes to cite', () => {
		const localFilms = Array.from({ length: 12 }, (_, i) =>
			film({
				...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]),
				rating: 3.5,
				tmdb: tmdb({
					genres: ['Drama'],
					runtime: 110,
					countries: ['FR'],
					voteCount: i === 0 ? 0 : 5000
				})
			})
		);
		const data = buildWrapped(localFilms, 2025);
		const deepCutScene = buildScenes(data!).find((scene) => scene.id === 'deep-cut');
		expect(deepCutScene).toBeUndefined();
	});
});
