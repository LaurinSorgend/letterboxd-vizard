import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from '../wrapped';
import { buildScenes } from './index';
import type { Accent } from './shared';

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
			{ id: 'top', accent: 'oxblood', bodyKind: 'posters' },
			{ id: 'genre', accent: 'forest', bodyKind: 'bars' },
			{ id: 'reach', accent: 'cyan', bodyKind: 'bars' },
			{ id: 'era', accent: 'gold', bodyKind: 'posters' },
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

	it('pins the genre scene exactly, since its content does not depend on fixture identity', () => {
		const data = buildWrapped(films, 2025);
		const genreScene = buildScenes(data!).find((scene) => scene.id === 'genre');
		expect(genreScene).toEqual({
			id: 'genre',
			accent: 'forest',
			label: 'Genre of the year',
			value: 'Drama',
			valueKind: 'name',
			note: '12 films, averaging ★ 3.50. A film counts once per genre it carries.',
			stats: [],
			body: { kind: 'bars', bars: [{ label: 'Drama', value: '12', share: 1 }] }
		});
	});
});
