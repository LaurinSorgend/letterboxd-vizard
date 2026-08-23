import { percent } from '$lib/format';
import { HABIT } from './habit';
import { RATINGS } from './ratings';
import { RHYTHM } from './rhythm';
import { TASTE } from './taste';
import type { Traits } from './traits';

export interface Rule {
	id: string;
	title: string;
	when: (t: Traits) => boolean;
	detail: (t: Traits) => string;
	/** The catch-all that always matches. It never appears as a runner-up, and it earns a near miss. */
	fallback?: true;
}

/**
 * Evaluation order: a narrower condition comes before a wider one, and anything reading ratings
 * comes after the guard that establishes there are enough ratings to read. `verdicts.test.ts`
 * holds this list and the rules themselves to the same set, so neither can drift alone.
 */
export const ORDER = [
	'archivist',
	'projectionist',
	'prodigal',
	'sampler',
	'ritualist',
	'abstainer',
	'serialist',
	'omnivore',
	'deep-diver',
	'populist',
	'frontrunner',
	'settler',
	'time-traveller',
	'resident',
	'subtitler',
	'globetrotter',
	'miniaturist',
	'marathoner',
	'specialist',
	'loyalist',
	'returner',
	'completist',
	'follower',
	'diarist',
	'cataloguer',
	'crammer',
	'lapsed',
	'hibernator',
	'sprinter',
	'weekender',
	'fixture',
	'barometer',
	'contrarian',
	'salvager',
	'selector',
	'metronome',
	'purist',
	'sceptic',
	'generous',
	'withholder',
	'enthusiast',
	'optimist',
	'regular'
];

/** What a year gets when nothing sharper is true of it. */
const REGULAR: Rule = {
	id: 'regular',
	title: 'The Regular',
	when: () => true,
	detail: (t) => `${t.films} films across ${t.activeMonths} months of the year.`,
	fallback: true
};

const SECTIONS: Rule[][] = [[REGULAR], RHYTHM, RATINGS, TASTE, HABIT];

export function rulesInOrder(): Rule[] {
	const byId = new Map(SECTIONS.flat().map((rule) => [rule.id, rule]));
	return ORDER.map((id) => byId.get(id)).filter((rule): rule is Rule => rule !== undefined);
}
