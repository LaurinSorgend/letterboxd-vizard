import { buildLibrary } from '$lib/year/library';
import { verdictFor } from '$lib/year/verdict';
import type { YearContext } from '$lib/year';
import type { DeckInput } from '$lib/wrapped/scenes/shared';
import type { EnrichedFilm } from '$lib/types';

/** A deck's input for any slice, however thin: scene tests check a frame, not the year's gate. */
export function deckOf(
	films: EnrichedFilm[],
	year: number,
	context: YearContext & { viewer?: string | null } = {}
): DeckInput {
	const { viewer = null, ...rest } = context;
	const library = buildLibrary({ films, year, ...rest });
	return { library, personality: verdictFor(library), viewer };
}
