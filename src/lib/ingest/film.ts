import type { Film, Profile } from '$lib/types';

/**
 * A library's identity for a film. Diary and review rows carry per-entry URIs, and the feed links
 * the member's own page, so the export parser and the feed merge both match films by name + year.
 */
export const filmKey = (name: string, year: number | null): string => `${name}::${year}`;

/** A film with nothing logged yet, the start of every film the export or the feed introduces. */
export function blankFilm({ uri, name, year }: Pick<Film, 'uri' | 'name' | 'year'>): Film {
	return {
		uri,
		name,
		year,
		rating: null,
		liked: false,
		review: null,
		watchedDates: [],
		entries: [],
		rewatch: false,
		tags: []
	};
}

/** A profile with only what is known; the export's profile.csv fills the rest. */
export function blankProfile(username: string): Profile {
	return { username, givenName: '', dateJoined: '', location: '' };
}
