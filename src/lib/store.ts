import { browser } from '$app/environment';
import type { EnrichedFilm, Profile } from '$lib/types';

/** Bump when the snapshot shape changes so stale data is ignored, not misread. */
const KEY = 'letterboxd-vizard:snapshot:v1';

/** The analysed result kept on the user's device so repeat visits skip re-uploading. */
export interface Snapshot {
	films: EnrichedFilm[];
	watchlistIds: number[];
	profile: Profile | null;
}

export function loadSnapshot(): Snapshot | null {
	if (!browser) return null;
	try {
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
