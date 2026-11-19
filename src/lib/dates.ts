/** Digital and disc releases trail the cinema run, so a film this old can still have one coming. */
export const RELEASE_LOOKBACK_DAYS = 2 * 365;

export function shiftDays(day: string, days: number): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

/** Leading year of a TMDB date (`2019-05-30`) or a TheTVDB year (`2019`); null when there is none. */
export function yearOf(text: string | null | undefined): number | null {
	const year = Number.parseInt(text?.slice(0, 4) ?? '', 10);
	return Number.isFinite(year) ? year : null;
}
