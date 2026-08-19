export * from './shared';
import {
	countScene,
	deepCutScene,
	eraScene,
	gapScene,
	genreScene,
	hoursScene,
	longestScene,
	monthScene,
	personScene,
	reachScene,
	streakScene,
	summaryScene,
	titleScene,
	topFilmsScene,
	verdictScene
} from './core';
import { plural, stars } from './shared';
import type { Scene } from './shared';
import type { Wrapped } from '../wrapped';

/** The deck, in order. Frames whose data is missing drop out rather than render a dash. */
export function buildScenes(data: Wrapped): Scene[] {
	return [
		titleScene(data),
		countScene(data),
		hoursScene(data),
		monthScene(data),
		streakScene(data),
		topFilmsScene(data),
		genreScene(data),
		personScene(
			'director',
			'indigo',
			'Director of the year',
			(person) =>
				`${plural(person.count, 'of their films')} this year${person.avg !== null ? `, averaging ${stars(person.avg)}` : ''}.`,
			data.topDirectors
		),
		personScene(
			'actor',
			'indigo',
			'On screen most',
			(person) => `Billed in ${plural(person.count, 'of your films')}.`,
			data.topActors
		),
		reachScene(data),
		eraScene(data),
		longestScene(data),
		gapScene(data),
		deepCutScene(data),
		verdictScene(data),
		summaryScene(data)
	].filter((scene): scene is Scene => scene !== null);
}
