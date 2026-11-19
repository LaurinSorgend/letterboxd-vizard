import { monthOf } from '../calendar';
import type { Library } from '../library';

/** Diary entries per calendar month, January first. */
export function perMonth(library: Library): number[] {
	const months = Array.from({ length: 12 }, () => 0);
	for (const date of library.dates) months[monthOf(date)] += 1;
	return months;
}

export interface PeakMonth {
	/** 0 = January. */
	month: number;
	count: number;
}

/** The month with the most entries, the earlier one on a tie. */
export function busiestMonth(library: Library): PeakMonth | null {
	const months = perMonth(library);
	const count = Math.max(...months);
	return count === 0 ? null : { month: months.indexOf(count), count };
}
