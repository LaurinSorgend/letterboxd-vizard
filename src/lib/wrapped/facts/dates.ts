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

export function longDate(iso: string): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC'
	});
}

export function weekdayName(index: number): string {
	return WEEKDAYS[index];
}

export function monthName(index: number): string {
	return MONTHS[index];
}
