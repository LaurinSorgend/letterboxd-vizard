import { describe, expect, it } from 'vitest';
import { exactTitleMatches, firstNearYear } from './match';

describe('matching a search result', () => {
	const results = [
		{ title: 'Suspiria', year: 2018 },
		{ title: 'Suspiria', year: 1977 },
		{ title: 'Suspiria Remastered', year: 1977 }
	];
	const same = exactTitleMatches(results, 'suspiria', (r) => r.title);

	it('keeps only results whose title matches exactly', () => {
		expect(same).toHaveLength(2);
	});

	it('prefers a result within a year of the wanted one, else the top-ranked', () => {
		expect(firstNearYear(same, 1978, (r) => r.year)?.year).toBe(1977);
		expect(firstNearYear(same, 1990, (r) => r.year)?.year).toBe(2018);
		expect(firstNearYear(same, null, (r) => r.year)?.year).toBe(2018);
	});
});
