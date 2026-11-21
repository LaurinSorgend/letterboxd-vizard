import { describe, expect, it } from 'vitest';
import { normalizeUsername } from './username';

describe('normalizeUsername', () => {
	it('reads the username from profile links, handles and padded input', () => {
		expect(normalizeUsername('https://letterboxd.com/laurins0/')).toBe('laurins0');
		expect(normalizeUsername('letterboxd.com/LaurinS0/films/')).toBe('laurins0');
		expect(normalizeUsername('@laurins0')).toBe('laurins0');
		expect(normalizeUsername('  laurins0  ')).toBe('laurins0');
		expect(normalizeUsername('laurins0')).toBe('laurins0');
	});
});
