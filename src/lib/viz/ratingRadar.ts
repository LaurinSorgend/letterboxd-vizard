import type { EnrichedFilm } from '$lib/types';

export interface RadarAxis {
	key: string;
	label: string;
}

/** Fixed axis order: your own rating first, then the three external sources. */
export const RADAR_AXES: RadarAxis[] = [
	{ key: 'yours', label: 'You' },
	{ key: 'tmdb', label: 'TMDB' },
	{ key: 'imdb', label: 'IMDb' },
	{ key: 'rt', label: 'Rotten Tomatoes' },
	{ key: 'metacritic', label: 'Metacritic' }
];

export interface RadarRow {
	film: EnrichedFilm;
	/** One value per RADAR_AXES entry, 0-100 normalized; null where that source has no rating. */
	values: (number | null)[];
}

/** Films with your rating plus at least one external source, every value normalized to 0-100. */
export function radarRows(films: EnrichedFilm[]): RadarRow[] {
	const rows: RadarRow[] = [];
	for (const film of films) {
		if (film.rating === null) continue;
		const values: (number | null)[] = [
			film.rating * 20,
			film.tmdb?.voteAverage != null ? film.tmdb.voteAverage * 10 : null,
			film.omdb?.imdbRating != null ? film.omdb.imdbRating * 10 : null,
			film.omdb?.rottenTomatoes ?? null,
			film.omdb?.metascore ?? null
		];
		if (values.slice(1).every((v) => v === null)) continue;
		rows.push({ film, values });
	}
	return rows;
}
