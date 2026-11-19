/** Dates and calendar names as the deck writes them, in English and read as UTC calendar days. */

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
	// 2024-01-01 was a Monday, so index 0 is Monday, matching `weekdayOf`.
	new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString('en', { weekday: 'long', timeZone: 'UTC' })
);

const monthLabel = (month: number, style: 'long' | 'narrow'): string =>
	new Date(Date.UTC(2000, month, 1)).toLocaleDateString('en', { month: style, timeZone: 'UTC' });

const MONTHS = Array.from({ length: 12 }, (_, month) => monthLabel(month, 'long'));
const MONTH_INITIALS = Array.from({ length: 12 }, (_, month) => monthLabel(month, 'narrow'));

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

/** 0 = Monday. */
export function weekdayName(index: number): string {
	return WEEKDAYS[index];
}

/** 0 = January. */
export function monthName(index: number): string {
	return MONTHS[index];
}

/** "J" for January, for a twelve-bar axis. */
export function monthInitial(index: number): string {
	return MONTH_INITIALS[index];
}
