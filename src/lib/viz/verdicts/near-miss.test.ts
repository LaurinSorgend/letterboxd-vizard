import { describe, expect, it } from 'vitest';
import { neutralTraits } from './test-traits';
import { nearestMiss } from './near-miss';

describe('nearestMiss', () => {
	it('picks the probe closest to its threshold', () => {
		const miss = nearestMiss(neutralTraits({ topCountryShare: 0.55 }));
		expect(miss).toMatchObject({ label: 'country', actual: '55%', threshold: '60%' });
	});

	it('never reports a probe that already fired', () => {
		expect(nearestMiss(neutralTraits({ topGenreShare: 0.8 }))?.label).not.toBe('genre');
	});

	it('returns null when there is nothing to measure', () => {
		expect(nearestMiss(neutralTraits({ films: 0, entries: 0 }))).toBeNull();
	});
});
