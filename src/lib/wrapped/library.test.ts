import { describe, expect, it } from 'vitest';
import { film, watched } from '$lib/testing/fixtures';
import { buildLibrary, datesIn, entriesIn, speaksEnglish, viewerLanguage } from './library';

const stalker = film(watched(['2024-12-31', '2025-04-12', '2025-01-02'], 4));
const nosferatu = film(watched(['2025-06-01']));
const older = film(watched(['2019-01-01']));

describe('buildLibrary', () => {
	const library = buildLibrary({ films: [stalker, nosferatu, older], year: 2025 });

	it('slices to films with a diary entry inside the year', () => {
		expect(library.slice).toEqual([stalker, nosferatu]);
		expect(library.all).toHaveLength(3);
	});

	it('collects the dates of the year in order, keeping repeats', () => {
		expect(library.dates).toEqual(['2025-01-02', '2025-04-12', '2025-06-01']);
	});

	it('defaults the locale to English', () => {
		expect(library.locale).toBe('en');
		expect(speaksEnglish(library)).toBe(true);
	});

	it('reads the language of the viewer off a BCP-47 tag', () => {
		expect(viewerLanguage(buildLibrary({ films: [], year: 2025, locale: 'de-DE' }))).toBe('de');
		expect(speaksEnglish(buildLibrary({ films: [], year: 2025, locale: 'de-DE' }))).toBe(false);
		expect(speaksEnglish(buildLibrary({ films: [], year: 2025, locale: 'en-GB' }))).toBe(true);
	});
});

describe('datesIn and entriesIn', () => {
	it('return only the year, ascending', () => {
		expect(datesIn(stalker, 2025)).toEqual(['2025-01-02', '2025-04-12']);
		expect(entriesIn(stalker, 2025).map((entry) => entry.date)).toEqual([
			'2025-01-02',
			'2025-04-12'
		]);
	});
});
