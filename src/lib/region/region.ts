import { browser } from '$app/environment';
import { readPref, writePref } from '$lib/prefs';
import { countryName, numericToAlpha2 } from '$lib/viz/countries';

const REGION_KEY = 'letterboxd-vizard:watch-region';

/** Every ISO country, by English name, for the "where do you watch" picker. */
export const REGIONS: { code: string; name: string }[] = [
	...new Set(Object.values(numericToAlpha2))
]
	.map((code) => ({ code, name: countryName(code) }))
	.sort((a, b) => a.name.localeCompare(b.name));

const isListed = (code: string | null | undefined): code is string =>
	!!code && REGIONS.some((region) => region.code === code);

function browserRegion(): string | null {
	if (!browser) return null;
	try {
		return new Intl.Locale(navigator.language).maximize().region ?? null;
	} catch {
		return null;
	}
}

/**
 * The saved country, else the one the browser's language names (en-GB → GB), else the US. Only a
 * country the picker lists is used, so the picker always shows the country the data is for.
 */
export function initialRegion(): string {
	const saved = readPref(REGION_KEY);
	if (isListed(saved)) return saved;
	const guessed = browserRegion();
	return isListed(guessed) ? guessed : 'US';
}

export function saveRegion(region: string): void {
	writePref(REGION_KEY, region);
}
