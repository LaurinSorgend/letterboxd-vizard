import * as habit from './habit';
import * as ratings from './ratings';
import * as rhythm from './rhythm';
import * as taste from './taste';
import type { Traits } from './traits';

export interface Rule {
	title: string;
	when: (t: Traits) => boolean;
	detail: (t: Traits) => string;
}

/**
 * Evaluation order, first match wins: a narrower condition comes before a wider one, and anything
 * reading ratings comes after the guard that establishes there are enough ratings to read.
 */
export const RULES: Rule[] = [
	taste.archivist,
	rhythm.projectionist,
	rhythm.prodigal,
	rhythm.sampler,
	rhythm.ritualist,
	ratings.abstainer,
	taste.serialist,
	taste.omnivore,
	taste.deepDiver,
	taste.populist,
	taste.frontrunner,
	taste.settler,
	taste.timeTraveller,
	taste.resident,
	taste.subtitler,
	taste.globetrotter,
	taste.miniaturist,
	taste.marathoner,
	taste.specialist,
	habit.loyalist,
	habit.returner,
	habit.completist,
	habit.follower,
	habit.diarist,
	habit.cataloguer,
	rhythm.crammer,
	rhythm.lapsed,
	rhythm.hibernator,
	rhythm.sprinter,
	rhythm.weekender,
	rhythm.fixture,
	ratings.barometer,
	ratings.contrarian,
	ratings.salvager,
	ratings.selector,
	ratings.metronome,
	ratings.purist,
	ratings.sceptic,
	ratings.generous,
	ratings.withholder,
	ratings.enthusiast,
	habit.optimist
];

/** What a year gets when no rule above is true of it. */
export const REGULAR: Omit<Rule, 'when'> = {
	title: 'The Regular',
	detail: (t) => `${t.films} films across ${t.activeMonths} months of the year.`
};
