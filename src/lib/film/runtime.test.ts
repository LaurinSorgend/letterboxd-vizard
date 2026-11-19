import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '$lib/year/library';
import { longest } from '$lib/year/facts/extremes';
import { buildTraits } from '$lib/year/verdict/traits';
import { sittingMinutes } from './runtime';

describe('sittingMinutes', () => {
	it("leaves out a series' whole run and a missing runtime", () => {
		expect(sittingMinutes(film({ tmdb: tmdb({ runtime: 120 }) }))).toBe(120);
		expect(sittingMinutes(film({ tmdb: tmdb({ mediaType: 'tv', runtime: 2700 }) }))).toBeNull();
		expect(sittingMinutes(film({ tmdb: tmdb({ runtime: null }) }))).toBeNull();
		expect(sittingMinutes(film())).toBeNull();
	});

	it("keeps a series out of the year's longest sitting and mean runtime", () => {
		const feature = film({ ...watched(['2025-03-01']), tmdb: tmdb({ runtime: 150 }) });
		const short = film({ ...watched(['2025-04-01']), tmdb: tmdb({ runtime: 90 }) });
		const series = film({
			...watched(['2025-05-01']),
			tmdb: tmdb({ mediaType: 'tv', runtime: 2700 })
		});
		const library = buildLibrary({ films: [feature, short, series], year: 2025 });
		expect(longest(library)).toBe(feature);
		const traits = buildTraits(library);
		expect(traits.meanRuntime).toBe(120);
		expect(traits.runtimeCount).toBe(2);
	});
});
