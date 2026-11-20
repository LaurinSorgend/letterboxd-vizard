import { browser } from '$app/environment';
import {
	RECORD_SCHEMA,
	type CollectionParts,
	type EnrichedFilm,
	type Profile,
	type WatchlistFilm
} from '$lib/types';

const PREFIX = 'vizard:snapshot:';
/**
 * Carries RECORD_SCHEMA, so a snapshot of old records is ignored rather than misread. A change to
 * the snapshot's own shape needs a new key too: add a suffix after the schema.
 */
const KEY = `${PREFIX}${RECORD_SCHEMA}`;

/** Where a library started: a full export, or only the RSS feed. */
export type LibrarySource = 'export' | 'feed';

/** The analysed result kept on the user's device so repeat visits skip re-uploading. */
interface Snapshot {
	films: EnrichedFilm[];
	watchlist: WatchlistFilm[];
	/** Written by older builds; derived from `watchlist` now, so ignored on read and no longer saved. */
	watchlistIds?: number[];
	profile: Profile | null;
	collections: CollectionParts[];
	source: LibrarySource;
}

/** Drops snapshots left by superseded KEY generations; they are dead weight against the quota. */
function sweepOldGenerations(): void {
	const stale = Object.keys(localStorage).filter((key) => key.startsWith(PREFIX) && key !== KEY);
	for (const key of stale) localStorage.removeItem(key);
}

export function loadSnapshot(): Snapshot | null {
	if (!browser) return null;
	try {
		sweepOldGenerations();
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Snapshot) : null;
	} catch {
		return null;
	}
}

/** Persists the snapshot; returns false if the browser refused it (e.g. quota exceeded). */
export function saveSnapshot(snapshot: Snapshot): boolean {
	if (!browser) return false;
	try {
		localStorage.setItem(KEY, JSON.stringify(snapshot));
		return true;
	} catch {
		return false;
	}
}

export function clearSnapshot(): void {
	if (browser) localStorage.removeItem(KEY);
}
