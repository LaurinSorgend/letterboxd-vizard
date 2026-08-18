import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from './wrapped';

/** Ten films clears MIN_FILMS, the floor buildRecap enforces. */
const year = Array.from({ length: 10 }, (_, i) =>
	film({ ...watched([`2025-03-0${(i % 9) + 1}`]), tmdb: tmdb({ runtime: 100 }) })
);

describe('buildWrapped', () => {
	it('carries a library built from the whole export', () => {
		const older = film(watched(['2019-05-05']));
		const data = buildWrapped([...year, older], 2025, { viewer: 'Laurin', locale: 'de-DE' });
		expect(data?.library.all).toHaveLength(11);
		expect(data?.library.slice).toHaveLength(10);
		expect(data?.library.year).toBe(2025);
		expect(data?.library.locale).toBe('de-de');
		expect(data?.viewer).toBe('Laurin');
	});

	it('still returns null for a year under the floor', () => {
		expect(buildWrapped(year.slice(0, 9), 2025)).toBeNull();
	});
});
