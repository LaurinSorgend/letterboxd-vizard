import { browser } from '$app/environment';
import { readPref, writePref } from '$lib/prefs';
import { COUNTRY_CODES, countryName } from '$lib/film/countries';

const REGION_KEY = 'vizard:watch-region';

/** Every ISO country, by English name, for the "where do you watch" picker. */
export const REGIONS: { code: string; name: string }[] = COUNTRY_CODES.map((code) => ({
	code,
	name: countryName(code)
})).sort((a, b) => a.name.localeCompare(b.name));

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
function initialRegion(): string {
	const saved = readPref(REGION_KEY);
	if (isListed(saved)) return saved;
	const guessed = browserRegion();
	return isListed(guessed) ? guessed : 'US';
}

/**
 * The country the viewer watches in, shared by the watchlist and the release calendar and saved
 * whenever it changes.
 */
class WatchRegion {
	#code = $state(initialRegion());

	get code(): string {
		return this.#code;
	}

	set code(next: string) {
		this.#code = next;
		writePref(REGION_KEY, next);
	}
}

export const region = new WatchRegion();
