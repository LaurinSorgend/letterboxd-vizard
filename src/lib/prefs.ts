import { browser } from '$app/environment';

/** A saved viewer preference, or null on the server or when the browser refuses storage. */
export function readPref(key: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

/** Saves a viewer preference; private windows and full quotas refuse, so it may last this visit only. */
export function writePref(key: string, value: string): void {
	if (!browser) return;
	try {
		localStorage.setItem(key, value);
	} catch {
		return;
	}
}

/** Forgets a viewer preference; a browser that refuses storage has nothing saved to forget. */
export function removePref(key: string): void {
	if (!browser) return;
	try {
		localStorage.removeItem(key);
	} catch {
		return;
	}
}
