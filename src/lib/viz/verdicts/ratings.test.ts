import { describe, expect, it } from 'vitest';
import { neutralTraits } from './test-traits';
import { RATINGS } from './ratings';
import { ORDER, rulesInOrder } from './rules';
import type { Traits } from './traits';

const rule = (id: string) => RATINGS.find((entry) => entry.id === id)!;

const IDS = [
	'generous',
	'abstainer',
	'metronome',
	'purist',
	'sceptic',
	'enthusiast',
	'withholder',
	'barometer',
	'contrarian',
	'salvager',
	'selector'
];

const READS_A_MEAN = [
	'generous',
	'metronome',
	'purist',
	'sceptic',
	'barometer',
	'contrarian',
	'salvager',
	'selector'
];

const spread = (entries: number): number[] =>
	Array.from({ length: 12 }, (_, i) =>
		i >= 10 ? 0 : Math.floor(entries / 10) + (i < entries % 10 ? 1 : 0)
	);

/**
 * A year of `films` films with `rated` of them rated, with every count and share that follows
 * from those two moved along with them, so no fixture below describes a year that cannot exist.
 */
function year(films: number, rated: number, over: Partial<Traits> = {}): Traits {
	const rewatches = Math.round(films * 0.1);
	const entries = films + rewatches;
	const liked = Math.round(films * 0.25);
	return neutralTraits({
		films,
		entries,
		monthCounts: spread(entries),
		recentYears: [films, 30, 26],
		rewatchShare: rewatches / entries,
		runtimeCount: films,
		rated,
		ratedShare: rated / films,
		likedCount: liked,
		likedShare: liked / films,
		crowdCount: Math.min(20, rated),
		metascoreCount: Math.min(20, films),
		...over
	});
}

describe('RATINGS', () => {
	it('exports the rating labels and wires them into the evaluation order', () => {
		expect(RATINGS.map((entry) => entry.id)).toEqual(IDS);
		const ordered = rulesInOrder().map((entry) => entry.id);
		for (const id of IDS) {
			expect(ORDER).toContain(id);
			expect(ordered).toContain(id);
		}
	});

	it('settles the guard against a thin rating sample before anything reads a mean', () => {
		const guard = ORDER.indexOf('abstainer');
		expect(guard).toBeGreaterThanOrEqual(0);
		for (const id of READS_A_MEAN) {
			expect(ORDER.indexOf(id)).toBeGreaterThan(guard);
		}
	});

	it('leaves a middling year unlabelled across the whole registry', () => {
		const fired = rulesInOrder()
			.filter((entry) => entry.when(neutralTraits()))
			.map((entry) => entry.id);
		expect(fired).toEqual(['regular']);
	});
});

describe('The Abstainer', () => {
	it('needs a fifth of the year rated at most', () => {
		expect(rule('abstainer').when(year(120, 24))).toBe(true);
		expect(rule('abstainer').when(year(120, 25))).toBe(false);
	});

	it('needs a year worth abstaining from', () => {
		expect(rule('abstainer').when(year(20, 3))).toBe(true);
		expect(rule('abstainer').when(year(19, 2))).toBe(false);
	});

	it('cites both counts', () => {
		expect(rule('abstainer').detail(year(120, 18))).toBe('120 films logged, 18 rated.');
	});
});

describe('The Metronome', () => {
	it('needs a narrow band', () => {
		expect(rule('metronome').when(year(120, 96, { pairShare: 0.7 }))).toBe(true);
		expect(rule('metronome').when(year(120, 96, { pairShare: 0.69 }))).toBe(false);
	});

	it('needs a real sample', () => {
		expect(rule('metronome').when(year(120, 30, { pairShare: 0.75 }))).toBe(true);
		expect(rule('metronome').when(year(120, 29, { pairShare: 0.75 }))).toBe(false);
	});

	it('cites the ratings inside the pair', () => {
		expect(rule('metronome').detail(year(120, 96, { pairShare: 0.75 }))).toBe(
			'72 of your 96 ratings fell inside a single half-star pair.'
		);
	});
});

describe('The Purist', () => {
	it('needs top marks to stay rare', () => {
		expect(rule('purist').when(year(120, 100, { fiveStarShare: 0.02 }))).toBe(true);
		expect(rule('purist').when(year(120, 100, { fiveStarShare: 0.03 }))).toBe(false);
	});

	it('needs fifty ratings behind the rarity', () => {
		expect(rule('purist').when(year(120, 50, { fiveStarShare: 0 }))).toBe(true);
		expect(rule('purist').when(year(120, 49, { fiveStarShare: 0 }))).toBe(false);
	});

	it('counts one five-star rating in the singular', () => {
		expect(rule('purist').detail(year(120, 100, { fiveStarShare: 0.01 }))).toBe(
			'1 five-star rating in 100 rated films.'
		);
	});

	it('counts none and several in the plural', () => {
		expect(rule('purist').detail(year(120, 60, { fiveStarShare: 0 }))).toBe(
			'0 five-star ratings in 60 rated films.'
		);
		expect(rule('purist').detail(year(120, 100, { fiveStarShare: 0.02 }))).toBe(
			'2 five-star ratings in 100 rated films.'
		);
	});
});

describe('The Sceptic', () => {
	it('needs a mean under the middle of the scale', () => {
		expect(rule('sceptic').when(year(120, 96, { meanRating: 2.7 }))).toBe(true);
		expect(rule('sceptic').when(year(120, 96, { meanRating: 2.75 }))).toBe(false);
	});

	it('needs twenty-five ratings behind the mean', () => {
		expect(rule('sceptic').when(year(120, 25, { meanRating: 2.6 }))).toBe(true);
		expect(rule('sceptic').when(year(120, 24, { meanRating: 2.6 }))).toBe(false);
	});

	it('stays quiet when nothing was rated at all', () => {
		expect(rule('sceptic').when(year(120, 0, { meanRating: null }))).toBe(false);
	});

	it('cites the mean in the same two decimals as The Generous', () => {
		expect(rule('sceptic').detail(year(120, 96, { meanRating: 2.6 }))).toBe(
			'Average rating ★ 2.6 across 96 films.'
		);
	});
});

describe('The Enthusiast', () => {
	it('needs half the year hearted', () => {
		expect(rule('enthusiast').when(year(120, 96, { likedCount: 60, likedShare: 0.5 }))).toBe(true);
		expect(rule('enthusiast').when(year(120, 96, { likedCount: 59, likedShare: 59 / 120 }))).toBe(
			false
		);
	});

	it('needs twenty-five films behind the hearts', () => {
		expect(rule('enthusiast').when(year(25, 20, { likedCount: 13, likedShare: 13 / 25 }))).toBe(
			true
		);
		expect(rule('enthusiast').when(year(24, 20, { likedCount: 13, likedShare: 13 / 24 }))).toBe(
			false
		);
	});

	it('cites the hearts against the year', () => {
		expect(rule('enthusiast').detail(year(120, 96, { likedCount: 70, likedShare: 70 / 120 }))).toBe(
			'You hearted 70 of 120 films.'
		);
	});
});

describe('The Withholder', () => {
	it('needs a year with no heart at all', () => {
		expect(rule('withholder').when(year(120, 96, { likedCount: 0, likedShare: 0 }))).toBe(true);
		expect(rule('withholder').when(year(120, 96, { likedCount: 1, likedShare: 1 / 120 }))).toBe(
			false
		);
	});

	it('needs forty films behind the silence', () => {
		expect(rule('withholder').when(year(40, 30, { likedCount: 0, likedShare: 0 }))).toBe(true);
		expect(rule('withholder').when(year(39, 30, { likedCount: 0, likedShare: 0 }))).toBe(false);
	});

	it('cites the year and the absence', () => {
		expect(rule('withholder').detail(year(120, 96, { likedCount: 0, likedShare: 0 }))).toBe(
			'120 films, no hearts.'
		);
	});
});

describe('The Barometer', () => {
	const close = { crowdCount: 30, crowdMeanAbs: 0.5, crowdMeanSigned: 0.1 };

	it('needs to sit inside half a star of the crowd', () => {
		expect(rule('barometer').when(year(120, 96, { ...close, crowdMeanAbs: 0.55 }))).toBe(true);
		expect(rule('barometer').when(year(120, 96, { ...close, crowdMeanAbs: 0.56 }))).toBe(false);
	});

	it('needs thirty films the crowd also scored', () => {
		expect(rule('barometer').when(year(120, 96, close))).toBe(true);
		expect(rule('barometer').when(year(120, 96, { ...close, crowdCount: 29 }))).toBe(false);
	});

	it('stays quiet when no film has a crowd score', () => {
		expect(
			rule('barometer').when(
				year(120, 96, { crowdCount: 0, crowdMeanAbs: null, crowdMeanSigned: null })
			)
		).toBe(false);
	});

	it('cites the gap in stars, to two decimals', () => {
		expect(rule('barometer').detail(year(120, 96, close))).toBe(
			'On average your ratings sat 0.5 stars from the crowd, across 30 films.'
		);
	});
});

describe('The Contrarian', () => {
	const against = { crowdCount: 96, crowdMeanAbs: 0.9, crowdMeanSigned: -0.9 };

	it('needs to sit well below the crowd, not merely apart from it', () => {
		expect(
			rule('contrarian').when(
				year(120, 96, { ...against, crowdMeanAbs: 0.7, crowdMeanSigned: -0.7 })
			)
		).toBe(true);
		expect(
			rule('contrarian').when(
				year(120, 96, { ...against, crowdMeanAbs: 0.7, crowdMeanSigned: -0.69 })
			)
		).toBe(false);
		expect(rule('contrarian').when(year(120, 96, { ...against, crowdMeanSigned: 0.9 }))).toBe(
			false
		);
	});

	it('needs thirty films the crowd also scored', () => {
		expect(rule('contrarian').when(year(120, 96, { ...against, crowdCount: 30 }))).toBe(true);
		expect(rule('contrarian').when(year(120, 96, { ...against, crowdCount: 29 }))).toBe(false);
	});

	it('cites the size of the disagreement', () => {
		expect(rule('contrarian').detail(year(120, 96, against))).toBe(
			'You rated 96 films against the crowd, on average 0.9 stars below them.'
		);
	});
});

describe('The Salvager', () => {
	it('needs a mean the critics would not sign off', () => {
		expect(rule('salvager').when(year(120, 96, { metascoreMean: 48, metascoreCount: 24 }))).toBe(
			true
		);
		expect(rule('salvager').when(year(120, 96, { metascoreMean: 49, metascoreCount: 24 }))).toBe(
			false
		);
	});

	it('needs twenty scored films behind the mean', () => {
		expect(rule('salvager').when(year(120, 96, { metascoreMean: 44, metascoreCount: 20 }))).toBe(
			true
		);
		expect(rule('salvager').when(year(120, 96, { metascoreMean: 44, metascoreCount: 19 }))).toBe(
			false
		);
	});

	it('stays quiet when no film carries a Metascore', () => {
		expect(rule('salvager').when(year(120, 96, { metascoreMean: null, metascoreCount: 0 }))).toBe(
			false
		);
	});

	it('says which side of the scale it sat on', () => {
		expect(
			rule('salvager').detail(year(120, 96, { metascoreMean: 43.6, metascoreCount: 24 }))
		).toBe('Average Metascore 44 across 24 scored films, below the midpoint of the scale.');
	});
});

describe('The Selector', () => {
	it('needs a mean the critics would sign off', () => {
		expect(rule('selector').when(year(120, 96, { metascoreMean: 74, metascoreCount: 24 }))).toBe(
			true
		);
		expect(rule('selector').when(year(120, 96, { metascoreMean: 73, metascoreCount: 24 }))).toBe(
			false
		);
	});

	it('needs twenty scored films behind the mean', () => {
		expect(rule('selector').when(year(120, 96, { metascoreMean: 78, metascoreCount: 20 }))).toBe(
			true
		);
		expect(rule('selector').when(year(120, 96, { metascoreMean: 78, metascoreCount: 19 }))).toBe(
			false
		);
	});

	it('stays quiet when no film carries a Metascore', () => {
		expect(rule('selector').when(year(120, 96, { metascoreMean: null, metascoreCount: 0 }))).toBe(
			false
		);
	});

	it('says which side of the scale it sat on, in its own words', () => {
		expect(
			rule('selector').detail(year(120, 96, { metascoreMean: 77.5, metascoreCount: 24 }))
		).toBe("Average Metascore 78 across 24 scored films, firmly in critics' favour.");
	});
});
