import { describe, expect, it } from 'vitest';
import { film, omdb, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '../library';
import { widestCriticGap } from './critics';

describe('widestCriticGap', () => {
	it('finds the widest disagreement in either direction', () => {
		const kind = film({
			name: 'Speak No Evil',
			...watched(['2025-05-01']),
			rating: 4.5,
			omdb: omdb({ metascore: 34 })
		});
		const harsh = film({ ...watched(['2025-05-02']), rating: 2, omdb: omdb({ metascore: 88 }) });
		const close = film({ ...watched(['2025-05-03']), rating: 4, omdb: omdb({ metascore: 82 }) });
		const result = widestCriticGap(buildLibrary({ films: [kind, harsh, close], year: 2025 }));
		expect(result).toMatchObject({
			film: kind,
			yours: 90,
			critics: 34,
			gap: 56,
			source: 'Metascore',
			kinder: 1,
			harsher: 2
		});
	});

	it('picks the harsher disagreement when it is the wider one', () => {
		const kind = film({ ...watched(['2025-05-01']), rating: 4.5, omdb: omdb({ metascore: 70 }) });
		const harsh = film({ ...watched(['2025-05-02']), rating: 1, omdb: omdb({ metascore: 95 }) });
		const result = widestCriticGap(buildLibrary({ films: [kind, harsh], year: 2025 }));
		expect(result).toMatchObject({
			film: harsh,
			yours: 20,
			critics: 95,
			gap: -75,
			source: 'Metascore',
			kinder: 1,
			harsher: 1
		});
	});

	it('falls back to Rotten Tomatoes when there is no Metascore', () => {
		const one = film({ ...watched(['2025-05-01']), rating: 5, omdb: omdb({ rottenTomatoes: 20 }) });
		expect(widestCriticGap(buildLibrary({ films: [one], year: 2025 }))).toMatchObject({
			critics: 20,
			source: 'Rotten Tomatoes'
		});
	});

	it('drops out below a thirty-point gap', () => {
		const one = film({ ...watched(['2025-05-01']), rating: 4, omdb: omdb({ metascore: 75 }) });
		expect(widestCriticGap(buildLibrary({ films: [one], year: 2025 }))).toBeNull();
	});

	it('drops out when OMDb never answered', () => {
		const one = film({ ...watched(['2025-05-01']), rating: 4, tmdb: tmdb() });
		expect(widestCriticGap(buildLibrary({ films: [one], year: 2025 }))).toBeNull();
	});
});
