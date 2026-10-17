import { browser } from '$app/environment';
import { countryName, numericToAlpha2 } from '$lib/viz/countries';

const REGION_KEY = 'letterboxd-vizard:watch-region';
const SERVICES_KEY = 'letterboxd-vizard:services:';

/** Every ISO country, by English name, for the "where do you watch" picker. */
export const REGIONS: { code: string; name: string }[] = [
	...new Set(Object.values(numericToAlpha2))
]
	.map((code) => ({ code, name: countryName(code) }))
	.sort((a, b) => a.name.localeCompare(b.name));

function read(key: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string): void {
	if (!browser) return;
	try {
		localStorage.setItem(key, value);
	} catch {
		// Private windows and full quotas refuse; the choice then lasts for this visit only.
	}
}

/** The saved country, else the one the browser's language names (en-GB → GB), else the US. */
export function initialRegion(): string {
	const saved = read(REGION_KEY);
	if (saved && /^[A-Z]{2}$/.test(saved)) return saved;
	if (browser) {
		try {
			const region = new Intl.Locale(navigator.language).maximize().region;
			if (region && /^[A-Z]{2}$/.test(region)) return region;
		} catch {
			// An unparseable language tag falls through to the default.
		}
	}
	return 'US';
}

export function saveRegion(region: string): void {
	write(REGION_KEY, region);
}

/** The services picked for a country; catalogues differ by country, so each keeps its own. */
export function loadServices(region: string): number[] {
	try {
		const parsed = JSON.parse(read(SERVICES_KEY + region) ?? '[]') as unknown;
		return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
	} catch {
		return [];
	}
}

export function saveServices(region: string, services: number[]): void {
	write(SERVICES_KEY + region, JSON.stringify(services));
}
