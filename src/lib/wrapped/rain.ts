import { imageUrl } from '$lib/viz/images';
import type { EnrichedFilm } from '$lib/types';

const COLUMNS = 5;
const PER_COLUMN = 4;
/** Seconds for one pass, one per column, chosen so no two columns fall in step. */
const SPEEDS = [21, 29, 24, 34, 26];
/** Negative offsets, so the tray is already running when the gate lights. */
const OFFSETS = [0, -8, -3, -14, -5];

export interface RainColumn {
	posters: string[];
	speed: number;
	offset: number;
}

/**
 * The year's posters dealt into falling columns for the opening frame. Films are dealt
 * round-robin in diary order, so neighbouring columns carry films watched weeks apart rather
 * than one run of the same week. A year with too few posters to fill the width gets none.
 */
export function posterRain(films: EnrichedFilm[]): RainColumn[] {
	const posters = films
		.map((film) => imageUrl(film.tmdb?.posterPath ?? null, 'w185'))
		.filter((url): url is string => url !== null);
	if (posters.length < COLUMNS) return [];
	return Array.from({ length: COLUMNS }, (_, column) => ({
		speed: SPEEDS[column],
		offset: OFFSETS[column],
		posters: Array.from(
			{ length: PER_COLUMN },
			(_, row) => posters[(row * COLUMNS + column) % posters.length]
		)
	}));
}
