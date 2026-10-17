import { describe, expect, it } from 'vitest';
import { compactAvailability, regionOffers } from './providers';

const netflix = { provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' };
const apple = { provider_id: 2, provider_name: 'Apple TV', logo_path: '/a.jpg' };

describe('watch availability', () => {
	const availability = compactAvailability({
		GB: { link: 'https://tmdb/gb', flatrate: [netflix], rent: [apple], buy: [apple] },
		DE: { link: 'https://tmdb/de', buy: [apple] }
	});

	it('lists each service once and refers to it by id per country', () => {
		expect(availability.providers).toEqual({ 8: ['Netflix', '/n.jpg'], 2: ['Apple TV', '/a.jpg'] });
		expect(availability.regions.DE).toEqual({ link: 'https://tmdb/de', buy: [2] });
	});

	it('spells out one country with every offer kind present', () => {
		expect(regionOffers(availability, 'GB')).toEqual({
			link: 'https://tmdb/gb',
			flatrate: [{ id: 8, name: 'Netflix', logoPath: '/n.jpg' }],
			free: [],
			ads: [],
			rent: [{ id: 2, name: 'Apple TV', logoPath: '/a.jpg' }],
			buy: [{ id: 2, name: 'Apple TV', logoPath: '/a.jpg' }]
		});
	});

	it('has no offers in a country TMDB does not list', () => {
		expect(regionOffers(availability, 'FR')).toBeNull();
	});
});
