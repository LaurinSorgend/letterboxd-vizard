import { readPref, writePref } from '$lib/prefs';

const SERVICES_KEY = 'letterboxd-vizard:services:';

/** The services picked for a country; catalogues differ by country, so each keeps its own. */
export function loadServices(region: string): number[] {
	try {
		const parsed = JSON.parse(readPref(SERVICES_KEY + region) ?? '[]') as unknown;
		return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
	} catch {
		return [];
	}
}

export function saveServices(region: string, services: number[]): void {
	writePref(SERVICES_KEY + region, JSON.stringify(services));
}
