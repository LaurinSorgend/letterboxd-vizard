import { describe, expect, it } from 'vitest';
import { neutralTraits } from './test-traits';
import { HABIT } from './habit';

const rule = (id: string) => HABIT.find((entry) => entry.id === id)!;

describe('habit rules', () => {
	it('The Returner keys on rewatch share', () => {
		expect(rule('returner').when(neutralTraits({ rewatchShare: 0.31, entries: 141 }))).toBe(true);
		expect(rule('returner').when(neutralTraits({ rewatchShare: 0.31, entries: 19 }))).toBe(false);
	});

	it('The Loyalist needs five from one franchise', () => {
		expect(
			rule('loyalist').when(neutralTraits({ topCollection: { name: 'Alien', count: 5 } }))
		).toBe(true);
		expect(
			rule('loyalist').when(neutralTraits({ topCollection: { name: 'Alien', count: 4 } }))
		).toBe(false);
	});

	it('The Follower scales its bar with the size of the year', () => {
		const small = neutralTraits({ films: 40, topCastMember: { name: 'Toni Collette', count: 7 } });
		const large = neutralTraits({ films: 200, topCastMember: { name: 'Toni Collette', count: 7 } });
		expect(rule('follower').when(small)).toBe(true);
		expect(rule('follower').when(large)).toBe(false);
	});

	it('The Diarist and The Cataloguer key on what was written down', () => {
		expect(rule('diarist').when(neutralTraits({ reviewShare: 0.52, films: 128 }))).toBe(true);
		expect(rule('diarist').when(neutralTraits({ reviewShare: 0.4, films: 128 }))).toBe(false);
		expect(
			rule('cataloguer').when(neutralTraits({ tagShare: 0.6, distinctTags: 9, films: 128 }))
		).toBe(true);
		expect(
			rule('cataloguer').when(neutralTraits({ tagShare: 0.6, distinctTags: 2, films: 128 }))
		).toBe(false);
		expect(
			rule('cataloguer').when(neutralTraits({ tagShare: 0.4, distinctTags: 9, films: 128 }))
		).toBe(false);
	});

	it('The Optimist needs a large backlog and a queue several years deep', () => {
		expect(
			rule('optimist').when(neutralTraits({ watchlistSize: 412, watchlistRatio: 6.7, films: 61 }))
		).toBe(true);
		expect(
			rule('optimist').when(neutralTraits({ watchlistSize: 90, watchlistRatio: 9, films: 10 }))
		).toBe(false);
	});

	it('The Optimist cites what was added this year when the export dated it', () => {
		const traits = neutralTraits({
			watchlistSize: 412,
			watchlistRatio: 6.7,
			films: 61,
			watchlistAddedThisYear: 74
		});
		expect(rule('optimist').detail(traits)).toContain('74');
	});

	it('The Optimist drops the growth claim when the export has no addition dates', () => {
		const traits = neutralTraits({
			watchlistSize: 412,
			watchlistRatio: 6.7,
			films: 61,
			watchlistAddedThisYear: 0
		});
		const detail = rule('optimist').detail(traits);
		expect(detail).not.toContain('growing');
		expect(detail).toContain('412');
	});
});
