import type { EnrichedFilm } from '$lib/types';
import { SOURCES } from '$lib/film/ratings';

export interface RadarRow {
	film: EnrichedFilm;
	/** One value per SOURCES entry, 0-100; null where that source has no rating. */
	values: (number | null)[];
}

/** Films with your rating plus at least one external source. */
export function radarRows(films: EnrichedFilm[]): RadarRow[] {
	return films.flatMap((film) => {
		const values = SOURCES.map((source) => source.of(film));
		return values[0] === null || values.slice(1).every((v) => v === null) ? [] : [{ film, values }];
	});
}
