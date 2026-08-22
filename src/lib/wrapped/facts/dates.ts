const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
	// 2024-01-01 was a Monday, so index 0 is Monday.
	new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString('en', { weekday: 'long', timeZone: 'UTC' })
);

const MONTHS = Array.from({ length: 12 }, (_, month) =>
	new Date(Date.UTC(2000, month, 1)).toLocaleDateString('en', { month: 'long', timeZone: 'UTC' })
);

/** Whole days since the epoch. Diary dates are calendar days, so they are always parsed as UTC. */
export function dayNumber(iso: string): number {
	return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function daysBetween(from: string, to: string): number {
	return dayNumber(to) - dayNumber(from);
}

/** 0 = Monday through 6 = Sunday, the order the bars are drawn in. */
export function weekdayOf(iso: string): number {
	return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function monthOf(iso: string): number {
	return Number.parseInt(iso.slice(5, 7), 10) - 1;
}

/**
 * Day and month, plus the year when the date falls outside `within`. Most dates on a slide sit
 * inside the year being recapped, where repeating it would be noise; a watchlist entry added
 * four years ago needs it.
 */
export function longDate(iso: string, within: number): string {
	return iso.slice(0, 4) === String(within) ? format(iso, undefined) : fullDate(iso);
}

/** Day, month and year, for a date a sentence cannot place on its own. */
export function fullDate(iso: string): string {
	return format(iso, 'numeric');
}

/**
 * Both ends of a range, written the same way. A window that crosses New Year would otherwise
 * read "between 28 December and 3 January 2026", dating one end and not the other.
 */
export function datePair(from: string, to: string, within: number): [string, string] {
	const inside = from.slice(0, 4) === String(within) && to.slice(0, 4) === String(within);
	return inside ? [format(from, undefined), format(to, undefined)] : [fullDate(from), fullDate(to)];
}

function format(iso: string, year: 'numeric' | undefined): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year,
		timeZone: 'UTC'
	});
}

export function weekdayName(index: number): string {
	return WEEKDAYS[index];
}

export function monthName(index: number): string {
	return MONTHS[index];
}
