import { nearestMiss } from './near-miss';
import { rulesInOrder } from './rules';
import { buildTraits } from './traits';
import type { Library } from '$lib/wrapped/library';

/** Two is enough to say the year had more than one shape without turning the slide into a list. */
const ALSO_TRUE = 2;

export interface Personality {
	title: string;
	detail: string;
	alsoTrue: string[];
}

/** The one wording of the runner-up line, shared by the slide, the saved card and the recap. */
export function alsoTrueLine(personality: Personality): string | null {
	return personality.alsoTrue.length > 0 ? `Also true: ${personality.alsoTrue.join(', ')}` : null;
}

/** First match wins, so the label is deterministic and the line under it cites its own number. */
export function verdictFor(library: Library): Personality {
	const traits = buildTraits(library);
	const matched = rulesInOrder().filter((rule) => rule.when(traits));
	const winner = matched[0];
	const others = matched.slice(1).filter((rule) => rule.id !== 'regular');
	if (winner.id !== 'regular') {
		return {
			title: winner.title,
			detail: winner.detail(traits),
			alsoTrue: others.slice(0, ALSO_TRUE).map((rule) => rule.title)
		};
	}
	const miss = nearestMiss(traits);
	return {
		title: winner.title,
		detail: miss
			? `${winner.detail(traits)} Your widest margin was ${miss.label} — ${miss.actual}, against a ${miss.threshold} threshold.`
			: winner.detail(traits),
		alsoTrue: []
	};
}
