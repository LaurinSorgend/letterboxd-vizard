import * as audience from './scenes/audience';
import * as core from './scenes/core';
import * as history from './scenes/history';
import * as library from './scenes/library';
import * as release from './scenes/release';
import * as timing from './scenes/timing';
import { plural, type Scene } from './scenes/shared';
import type { Wrapped } from './wrapped';

/** Twenty slides is about four minutes at a comfortable pace. Everything true beyond that waits. */
export const DECK_CAP = 20;

interface Entry {
	/** Narrative position is this array's order; rank decides who survives the cap. */
	rank: number;
	build: (data: Wrapped) => Scene | null;
}

const SEQUENCE: Entry[] = [
	{ rank: 100, build: core.titleScene },
	{ rank: 99, build: core.countScene },
	{ rank: 93, build: history.perYearScene },
	{ rank: 66, build: core.hoursScene },
	{ rank: 91, build: core.monthScene },
	{ rank: 90, build: core.streakScene },
	{ rank: 92, build: timing.gapSilenceScene },
	{ rank: 78, build: timing.weekdayScene },
	{ rank: 40, build: timing.bestWeekScene },
	{ rank: 36, build: timing.doubleBillScene },
	{ rank: 95, build: core.topFilmsScene },
	{ rank: 85, build: history.fiveStarScene },
	{ rank: 74, build: library.likedScene },
	{ rank: 84, build: history.driftScene },
	{ rank: 81, build: core.genreScene },
	{ rank: 86, build: core.directorScene },
	{ rank: 75, build: history.firstTimersScene },
	{ rank: 76, build: library.breadthScene },
	{ rank: 73, build: core.actorScene },
	{ rank: 68, build: library.collectionScene },
	{ rank: 72, build: core.reachScene },
	{ rank: 71, build: audience.languageScene },
	{ rank: 70, build: core.eraScene },
	{ rank: 94, build: release.longestWaitScene },
	{ rank: 89, build: release.freshnessScene },
	{ rank: 64, build: release.shelfScene },
	{ rank: 62, build: core.longestScene },
	{ rank: 77, build: core.gapScene },
	{ rank: 88, build: audience.criticScene },
	{ rank: 80, build: core.deepCutScene },
	{ rank: 79, build: audience.obscurityScene },
	{ rank: 83, build: library.writingScene },
	{ rank: 38, build: library.tagScene },
	{ rank: 82, build: library.watchlistScene },
	{ rank: 60, build: library.watchlistAgeScene },
	{ rank: 87, build: history.mostLoggedScene }
];

export interface Deck {
	/** Shown in order the first time through. */
	main: Scene[];
	/** True frames the cap pushed out; empty when everything fitted. */
	extras: Scene[];
	/** The verdict and the poster, always last. */
	closing: Scene[];
}

/**
 * The gate that stands between the deck and everything the cap held back. It stays in the tray
 * once opened, so expanding never shifts an index the viewer has already passed.
 */
function gateScene(count: number, expanded: boolean): Scene {
	return {
		id: 'more',
		accent: 'neutral',
		label: expanded ? 'The rest of the year' : 'There is more',
		value: String(count),
		valueKind: 'number',
		note: expanded
			? `${plural(count, 'frame')} follow, then the verdict.`
			: `${plural(count, 'more frame')} came out true this year and did not fit the run. Open them, or carry on to the verdict.`,
		stats: [],
		body: { kind: 'gate', count, expanded }
	};
}

export function buildDeck(data: Wrapped, cap = DECK_CAP): Deck {
	const built = SEQUENCE.map((entry) => ({ rank: entry.rank, scene: entry.build(data) })).filter(
		(entry): entry is { rank: number; scene: Scene } => entry.scene !== null
	);
	const keep = new Set(
		[...built]
			.sort((a, b) => b.rank - a.rank)
			.slice(0, cap)
			.map((entry) => entry.scene.id)
	);
	return {
		main: built.filter((entry) => keep.has(entry.scene.id)).map((entry) => entry.scene),
		extras: built.filter((entry) => !keep.has(entry.scene.id)).map((entry) => entry.scene),
		closing: [core.verdictScene(data), core.summaryScene(data)]
	};
}

export function assemble(deck: Deck, expanded: boolean): Scene[] {
	const gate = deck.extras.length > 0 ? [gateScene(deck.extras.length, expanded)] : [];
	return [...deck.main, ...gate, ...(expanded ? deck.extras : []), ...deck.closing];
}
