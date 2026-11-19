import { DAY_MS } from '$lib/math';

/*
 * Diary dates are calendar days with no time zone of their own, so everything here reads them
 * as UTC.
 */

export function inYear(iso: string, year: number): boolean {
	return iso.startsWith(`${year}-`);
}

/** Whole days since the epoch. */
export function dayNumber(iso: string): number {
	return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** The inverse of `dayNumber`. */
export function isoOfDay(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
	return dayNumber(to) - dayNumber(from);
}

/** 0 = Monday through 6 = Sunday. */
export function weekdayOf(iso: string): number {
	return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** 0 = January. */
export function monthOf(iso: string): number {
	return Number.parseInt(iso.slice(5, 7), 10) - 1;
}
