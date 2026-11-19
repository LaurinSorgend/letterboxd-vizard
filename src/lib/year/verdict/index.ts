import { nearestMiss } from './near-miss';
import { REGULAR, RULES } from './rules';
import { buildTraits } from './traits';
import type { Library } from '../library';

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
	const [winner, ...others] = RULES.filter((rule) => rule.when(traits));
	if (winner) {
		return {
			title: winner.title,
			detail: winner.detail(traits),
			alsoTrue: others.slice(0, ALSO_TRUE).map((rule) => rule.title)
		};
	}
	const miss = nearestMiss(traits);
	const detail = REGULAR.detail(traits);
	return {
		title: REGULAR.title,
		detail: miss
			? `${detail} Your widest margin was ${miss.label} — ${miss.actual}, against a ${miss.threshold} threshold.`
			: detail,
		alsoTrue: []
	};
}
