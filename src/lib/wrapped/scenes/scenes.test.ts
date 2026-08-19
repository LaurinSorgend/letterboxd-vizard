import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from '../wrapped';
import { buildScenes } from './index';

const films = Array.from({ length: 12 }, (_, i) =>
	film({
		...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]),
		rating: 3.5,
		tmdb: tmdb({ genres: ['Drama'], runtime: 110, countries: ['FR'] })
	})
);

describe('buildScenes', () => {
	it('opens on the title and closes on the summary', () => {
		const data = buildWrapped(films, 2025);
		const ids = buildScenes(data!).map((scene) => scene.id);
		expect(ids[0]).toBe('title');
		expect(ids.at(-1)).toBe('summary');
		expect(ids).toContain('verdict');
	});

	it('never emits a scene with an empty value', () => {
		for (const scene of buildScenes(buildWrapped(films, 2025)!)) {
			expect(scene.value.length).toBeGreaterThan(0);
			expect(scene.label.length).toBeGreaterThan(0);
		}
	});
});
