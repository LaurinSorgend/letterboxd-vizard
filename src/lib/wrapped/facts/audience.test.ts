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
		expect(result).toMatchObject({ median: 13000, lowerQuartile: 7000, overTenThousand: 15 });
	});

	it('drops out under twenty-five films with a vote count', () => {
		expect(obscurity(buildLibrary({ films: withVotes([1, 2, 3]), year: 2025 }))).toBeNull();
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
		expect(result).toMatchObject({ language: 'en', label: 'English', count: 5, own: 10 });
		expect(result?.share).toBeCloseTo(1 / 3);
		expect(result?.largest?.label).toBe('French');
	});

	it('measures against German for a German-speaking viewer', () => {
		const films = spoken([...Array(10).fill('de'), ...Array(5).fill('en')]);
		const result = languageShare(buildLibrary({ films, year: 2025, locale: 'de-DE' }));
		expect(result).toMatchObject({ language: 'de', label: 'German', count: 5, own: 10 });
	});

	it('drops out under a tenth of the year', () => {
		const films = spoken([...Array(19).fill('en'), 'fr']);
		expect(languageShare(buildLibrary({ films, year: 2025 }))).toBeNull();
	});
});
