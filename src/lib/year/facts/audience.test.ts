import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildLibrary } from '../library';
import { languageShare, obscurity } from './audience';

const withVotes = (votes: number[]) =>
	votes.map((voteCount, i) =>
		film({ ...watched([`2025-0${(i % 9) + 1}-01`]), tmdb: tmdb({ voteCount }) })
	);

describe('obscurity', () => {
	it('reports the median and lower quartile of the vote counts', () => {
		const votes = Array.from({ length: 25 }, (_, i) => (i + 1) * 1000);
		const result = obscurity(buildLibrary({ films: withVotes(votes), year: 2025 }));
		expect(result).toMatchObject({ voted: 25, median: 13000, lowerQuartile: 7000, popular: 15 });
	});
});

describe('languageShare', () => {
	const spoken = (codes: string[]) =>
		codes.map((originalLanguage, i) =>
			film({ ...watched([`2025-0${(i % 9) + 1}-01`]), tmdb: tmdb({ originalLanguage }) })
		);

	it('measures against English for an English-speaking viewer', () => {
		const films = spoken([...Array(10).fill('en'), ...Array(5).fill('fr')]);
		const result = languageShare(buildLibrary({ films, year: 2025 }));
		expect(result).toMatchObject({ label: 'English', count: 5, own: 10 });
		expect(result?.share).toBeCloseTo(1 / 3);
		expect(result?.bars[0]?.label).toBe('French');
	});

	it('measures against the language watched most, whatever the browser says', () => {
		const films = spoken([...Array(10).fill('de'), ...Array(5).fill('en')]);
		const result = languageShare(buildLibrary({ films, year: 2025, locale: 'en-GB' }));
		expect(result).toMatchObject({ label: 'German', count: 5, own: 10 });
	});

	it('counts two codes for one language as that one language', () => {
		const films = spoken([...Array(10).fill('iw'), ...Array(5).fill('he'), ...Array(5).fill('fr')]);
		const result = languageShare(buildLibrary({ films, year: 2025 }));
		expect(result).toMatchObject({ label: 'Hebrew', count: 5, own: 15, languages: 2 });
	});
});
