import { describe, expect, it } from 'vitest';
import { neutralTraits } from './test-traits';
import { TASTE } from './taste';

const rule = (id: string) => TASTE.find((entry) => entry.id === id)!;

describe('taste rules', () => {
	it('The Populist and The Omnivore split the vote distribution', () => {
		expect(rule('populist').when(neutralTraits({ medianVotes: 24_000, films: 40 }))).toBe(true);
		expect(rule('populist').when(neutralTraits({ medianVotes: 12_000, films: 40 }))).toBe(false);
		expect(
			rule('omnivore').when(neutralTraits({ lowVoteShare: 0.18, highVoteShare: 0.24, films: 40 }))
		).toBe(true);
		expect(
			rule('omnivore').when(neutralTraits({ lowVoteShare: 0.18, highVoteShare: 0.1, films: 40 }))
		).toBe(false);
	});

	it('The Frontrunner, Archivist and Settler key on release year', () => {
		expect(rule('frontrunner').when(neutralTraits({ releasedThisYearShare: 0.6, films: 40 }))).toBe(
			true
		);
		expect(rule('frontrunner').when(neutralTraits({ releasedThisYearShare: 0.4, films: 40 }))).toBe(
			false
		);
		expect(rule('archivist').when(neutralTraits({ preEightiesShare: 0.95, films: 20 }))).toBe(true);
		expect(rule('archivist').when(neutralTraits({ preEightiesShare: 0.5, films: 20 }))).toBe(false);
		expect(
			rule('settler').when(neutralTraits({ topDecade: 1970, topDecadeShare: 0.55, films: 40 }))
		).toBe(true);
	});

	it('The Settler ignores the current decade', () => {
		expect(
			rule('settler').when(neutralTraits({ topDecade: 2020, topDecadeShare: 0.8, films: 40 }))
		).toBe(false);
	});

	it('The Subtitler measures against the language of the viewer', () => {
		expect(rule('subtitler').when(neutralTraits({ foreignShare: 0.7, films: 40 }))).toBe(true);
		expect(rule('subtitler').when(neutralTraits({ foreignShare: 0.4, films: 40 }))).toBe(false);
	});

	it('The Resident holds the United States to a higher bar', () => {
		expect(rule('resident').when(neutralTraits({ topCountry: 'KR', topCountryShare: 0.68 }))).toBe(
			true
		);
		expect(rule('resident').when(neutralTraits({ topCountry: 'US', topCountryShare: 0.68 }))).toBe(
			false
		);
		expect(rule('resident').when(neutralTraits({ topCountry: 'US', topCountryShare: 0.9 }))).toBe(
			true
		);
	});

	it('The Specialist, Miniaturist and Serialist key on genre, runtime and format', () => {
		expect(
			rule('specialist').when(neutralTraits({ topGenre: 'Horror', topGenreShare: 0.52, films: 40 }))
		).toBe(true);
		expect(
			rule('specialist').when(neutralTraits({ topGenre: 'Horror', topGenreShare: 0.3, films: 40 }))
		).toBe(false);
		expect(rule('miniaturist').when(neutralTraits({ meanRuntime: 89, runtimeCount: 40 }))).toBe(
			true
		);
		expect(rule('miniaturist').when(neutralTraits({ meanRuntime: 100, runtimeCount: 40 }))).toBe(
			false
		);
		expect(rule('serialist').when(neutralTraits({ televisionShare: 0.27, films: 40 }))).toBe(true);
		expect(rule('serialist').when(neutralTraits({ televisionShare: 0.1, films: 40 }))).toBe(false);
	});

	it('names the thing it found', () => {
		expect(
			rule('specialist').detail(
				neutralTraits({ topGenre: 'Horror', topGenreShare: 0.52, films: 120 })
			)
		).toContain('horror');
	});
});
