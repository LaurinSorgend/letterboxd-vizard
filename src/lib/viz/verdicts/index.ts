import { buildTraits } from './traits';
import { rulesInOrder } from './rules';
import type { Library } from '$lib/wrapped/library';

export interface Personality {
	title: string;
	detail: string;
	/** Labels that also matched, in evaluation order. Populated in Task 26. */
	alsoTrue: string[];
}

/** First match wins, so the label is deterministic and the line under it cites its own number. */
export function verdictFor(library: Library): Personality {
	const traits = buildTraits(library);
	const matched = rulesInOrder().filter((rule) => rule.when(traits));
	const winner = matched[0];
	return { title: winner.title, detail: winner.detail(traits), alsoTrue: [] };
}
