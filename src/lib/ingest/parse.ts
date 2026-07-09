import { unzipSync } from 'fflate';
import Papa from 'papaparse';
import type { Film, LetterboxdData, Profile } from '$lib/types';

type Row = Record<string, string>;

function parseCsv(bytes: Uint8Array | undefined): Row[] {
	if (!bytes) return [];
	const text = new TextDecoder().decode(bytes);
	return Papa.parse<Row>(text, { header: true, skipEmptyLines: true }).data;
}

function toYear(value: string | undefined): number | null {
	const year = Number.parseInt(value ?? '', 10);
	return Number.isFinite(year) ? year : null;
}

/**
 * Parses a Letterboxd data-export zip into one film list keyed by Letterboxd URI.
 * Handles zips with the CSVs at the root as well as inside a single top-level folder.
 */
export function parseExport(zipBytes: Uint8Array): LetterboxdData {
	const entries = unzipSync(zipBytes);
	const paths = Object.keys(entries);
	const root = paths[0]?.split('/')[0];
	const prefix = root && paths.every((p) => p.startsWith(root + '/')) ? root + '/' : '';
	const csv = (name: string) => parseCsv(entries[prefix + name]);

	if (!entries[prefix + 'watched.csv']) {
		throw new Error('watched.csv not found — is this a Letterboxd data export zip?');
	}

	// Diary and review rows carry per-entry URIs, so films merge by name + year.
	const films = new Map<string, Film>();
	const get = (row: Row): Film => {
		const key = `${row['Name']}::${row['Year']}`;
		let film = films.get(key);
		if (!film) {
			film = {
				uri: row['Letterboxd URI'],
				name: row['Name'],
				year: toYear(row['Year']),
				rating: null,
				liked: false,
				review: null,
				watchedDates: [],
				rewatch: false,
				tags: []
			};
			films.set(key, film);
		}
		return film;
	};

	for (const row of csv('watched.csv')) get(row);
	for (const row of csv('ratings.csv')) {
		const rating = Number.parseFloat(row['Rating']);
		if (Number.isFinite(rating)) get(row).rating = rating;
	}
	for (const row of csv('likes/films.csv')) get(row).liked = true;
	for (const row of csv('diary.csv')) {
		const film = get(row);
		if (row['Watched Date']) film.watchedDates.push(row['Watched Date']);
		if (row['Rewatch'] === 'Yes') film.rewatch = true;
		if (row['Tags']) film.tags.push(...row['Tags'].split(',').map((t) => t.trim()));
	}
	for (const row of csv('reviews.csv')) {
		if (row['Review']) get(row).review = row['Review'];
	}

	const watchlist = csv('watchlist.csv').map((row) => ({
		uri: row['Letterboxd URI'],
		name: row['Name'],
		year: toYear(row['Year'])
	}));

	const profileRow = csv('profile.csv')[0];
	const profile: Profile | null = profileRow
		? {
				username: profileRow['Username'] ?? '',
				givenName: profileRow['Given Name'] ?? '',
				dateJoined: profileRow['Date Joined'] ?? '',
				location: profileRow['Location'] ?? ''
			}
		: null;

	return { films: [...films.values()], watchlist, profile };
}
