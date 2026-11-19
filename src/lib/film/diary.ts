import type { Film } from '$lib/types';

/** The newest diary date of a film, or null when it was never logged. Diary order is not date order. */
export function latestWatch(film: Pick<Film, 'watchedDates'>): string | null {
	let latest: string | null = null;
	for (const date of film.watchedDates) if (latest === null || date > latest) latest = date;
	return latest;
}
