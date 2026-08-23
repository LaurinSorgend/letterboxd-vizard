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
}

/**
 * Evaluation order: a narrower condition comes before a wider one, and anything reading ratings
 * comes after the guard that establishes there are enough ratings to read. Ids not yet
 * implemented are skipped, so this list is the plan as well as the order.
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

const EXISTING: Rule[] = [
	{
		id: 'deep-diver',
		title: 'The Deep Diver',
		when: (t) => (t.obscureShare ?? 0) >= 0.45,
		detail: (t) =>
			`${percent(t.obscureShare ?? 0)} of what you watched has under 1,000 TMDB ratings.`
	},
	{
		id: 'time-traveller',
		title: 'The Time Traveller',
		when: (t) => t.medianYear !== null && t.year - t.medianYear >= 25,
		detail: (t) => `Your median film came out in ${t.medianYear}.`
	},
	{
		id: 'globetrotter',
		title: 'The Globetrotter',
		when: (t) => t.countries >= 20,
		detail: (t) => `You watched films from ${t.countries} countries.`
	},
	{
		id: 'marathoner',
		title: 'The Marathoner',
		when: (t) => (t.meanRuntime ?? 0) >= 125,
		detail: (t) => `Your average film ran ${Math.round(t.meanRuntime ?? 0)} minutes.`
	},
	{
		id: 'completist',
		title: 'The Completist',
		when: (t) => (t.topDirector?.count ?? 0) >= 6,
		detail: (t) => `You watched ${t.topDirector?.count} films by ${t.topDirector?.name}.`
	},
	{
		id: 'generous',
		title: 'The Generous',
		when: (t) => (t.meanRating ?? 0) >= 3.8,
		detail: (t) => `You averaged ★ ${(t.meanRating ?? 0).toFixed(1)} across the year.`
	},
	{
		id: 'regular',
		title: 'The Regular',
		when: () => true,
		detail: (t) => `${t.films} films across ${t.activeMonths} months of the year.`
	}
];

/** Every implemented rule, in evaluation order. Later tasks add sections to `SECTIONS`. */
const SECTIONS: Rule[][] = [EXISTING, RHYTHM, RATINGS, TASTE, HABIT];

export function rulesInOrder(): Rule[] {
	const byId = new Map(SECTIONS.flat().map((rule) => [rule.id, rule]));
	return ORDER.map((id) => byId.get(id)).filter((rule): rule is Rule => rule !== undefined);
}
