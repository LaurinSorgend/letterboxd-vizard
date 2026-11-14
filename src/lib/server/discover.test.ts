import { describe, expect, it } from 'vitest';
import { discoverParams } from './discover';

describe('discoverParams', () => {
	it('spans 90 days ahead and 730 days back across month and year boundaries', () => {
		const params = discoverParams('DE', 'theatrical', 2, '2026-11-14');
		expect(params['release_date.gte']).toBe('2026-11-14');
		expect(params['release_date.lte']).toBe('2027-02-12');
		expect(params['primary_release_date.gte']).toBe('2024-11-14');
		expect(params.page).toBe('2');
		expect(params.region).toBe('DE');
	});

	it('crosses a month end', () => {
		expect(discoverParams('US', 'digital', 1, '2026-01-31')['release_date.lte']).toBe('2026-05-01');
	});

	it('maps each kind to its TMDB release type', () => {
		expect(discoverParams('US', 'theatrical', 1, '2026-11-14').with_release_type).toBe('2|3');
		expect(discoverParams('US', 'digital', 1, '2026-11-14').with_release_type).toBe('4');
		expect(discoverParams('US', 'physical', 1, '2026-11-14').with_release_type).toBe('5');
	});

	it('adds with_people only when people are given', () => {
		expect(discoverParams('US', 'digital', 1, '2026-11-14')).not.toHaveProperty('with_people');
		expect(discoverParams('US', 'digital', 1, '2026-11-14', [])).not.toHaveProperty('with_people');
		expect(discoverParams('US', 'digital', 1, '2026-11-14', [1, 2]).with_people).toBe('1|2');
	});
});
