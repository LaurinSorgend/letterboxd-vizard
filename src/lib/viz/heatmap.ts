import { binIndex } from './ramp';
import type { EnrichedFilm } from '$lib/types';

/** One cell of a heatmap grid; `bin` is null when nothing was watched that period. */
export interface HeatCell {
	key: string;
	label: string;
	minutes: number;
	bin: number | null;
	films: EnrichedFilm[];
}

/** A rectangular heatmap with sparse row/column labels and a bin legend. */
export interface HeatmapGrid {
	rows: (HeatCell | null)[][];
	rowLabels: string[];
	colLabels: string[];
	legend: string[];
	description: string;
	empty: boolean;
}

/* Watchtime bins in minutes; index i = value >= threshold[i-1]. Map colors reused. */
const DAILY_THRESHOLDS = [60, 120, 240, 360];
const DAILY_LEGEND = ['< 1h', '1–2h', '2–4h', '4–6h', '6h+'];
const WEEKLY_THRESHOLDS = [180, 360, 720, 1200];
const WEEKLY_LEGEND = ['< 3h', '3–6h', '6–12h', '12–20h', '20h+'];

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Bucket {
	minutes: number;
	films: EnrichedFilm[];
}

/** Total watched runtime as a human string; "runtime unknown" when the sum is zero. */
export function formatWatchtime(minutes: number): string {
	if (minutes <= 0) return 'runtime unknown';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function toUtcDate(iso: string): Date {
	const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

function isoOf(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
	return new Date(date.getTime() + n * DAY_MS);
}

function binOf(bucket: Bucket | undefined, thresholds: number[]): number | null {
	if (!bucket || bucket.films.length === 0) return null;
	return binIndex(bucket.minutes, thresholds);
}

/** Days elapsed since the week's Monday (Mon=0 … Sun=6). */
function daysSinceMonday(date: Date): number {
	return (date.getUTCDay() + 6) % 7;
}

/** Sum each diary watch's runtime into its calendar day (YYYY-MM-DD). */
function bucketsByDay(films: EnrichedFilm[]): Map<string, Bucket> {
	const days = new Map<string, Bucket>();
	for (const film of films) {
		const minutes = film.tmdb?.runtime ?? 0;
		for (const date of film.watchedDates) {
			const day = date.slice(0, 10);
			if (day.length !== 10) continue;
			let bucket = days.get(day);
			if (!bucket) days.set(day, (bucket = { minutes: 0, films: [] }));
			bucket.minutes += minutes;
			bucket.films.push(film);
		}
	}
	return days;
}

/** Week column (0-based, Monday-anchored) of a date within its own calendar year. */
function weekOfYear(date: Date): number {
	const jan1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
	const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / DAY_MS);
	return Math.floor((dayOfYear + daysSinceMonday(jan1)) / 7);
}

function dailyLabel(day: Date): string {
	return `${WEEKDAYS[day.getUTCDay()]}, ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
}

/** GitHub-style calendar: 7 weekday rows × week columns for one year. */
export function buildDailyHeatmap(films: EnrichedFilm[], year: number): HeatmapGrid {
	const byDay = bucketsByDay(films);
	const jan1 = new Date(Date.UTC(year, 0, 1));
	const dec31 = new Date(Date.UTC(year, 11, 31));
	const start = addDays(jan1, -daysSinceMonday(jan1));
	const cols = Math.ceil((dec31.getTime() - start.getTime()) / DAY_MS / 7);

	const rows: (HeatCell | null)[][] = Array.from({ length: 7 }, () => Array(cols).fill(null));
	const colLabels = Array<string>(cols).fill('');
	let empty = true;
	let lastMonth = -1;

	for (let w = 0; w < cols; w++) {
		for (let r = 0; r < 7; r++) {
			const day = addDays(start, w * 7 + r);
			if (day < jan1 || day > dec31) continue;
			if (colLabels[w] === '' && day.getUTCMonth() !== lastMonth) {
				lastMonth = day.getUTCMonth();
				colLabels[w] = MONTHS[lastMonth];
			}
			const bucket = byDay.get(isoOf(day));
			const bin = binOf(bucket, DAILY_THRESHOLDS);
			if (bin !== null) empty = false;
			rows[r][w] = {
				key: isoOf(day),
				label: dailyLabel(day),
				minutes: bucket?.minutes ?? 0,
				bin,
				films: bucket?.films ?? []
			};
		}
	}

	// Rows run Mon…Sun; label every other row (Mon, Wed, Fri).
	return {
		rows,
		rowLabels: Array.from({ length: 7 }, (_, r) => (r % 2 === 0 ? WEEKDAYS[(r + 1) % 7] : '')),
		colLabels,
		legend: DAILY_LEGEND,
		description: `Watchtime per day in ${year}`,
		empty
	};
}

function weeklyColLabels(refYear: number, cols: number): string[] {
	const labels = Array<string>(cols).fill('');
	const jan1 = new Date(Date.UTC(refYear, 0, 1));
	const start = addDays(jan1, -daysSinceMonday(jan1));
	let lastMonth = -1;
	for (let w = 0; w < cols; w++) {
		const weekStart = addDays(start, w * 7);
		if (weekStart.getUTCFullYear() > refYear) break;
		if (weekStart.getUTCFullYear() < refYear) continue; // week 0 can start in the prior December
		if (weekStart.getUTCMonth() !== lastMonth) {
			lastMonth = weekStart.getUTCMonth();
			labels[w] = MONTHS[lastMonth];
		}
	}
	return labels;
}

/** One row per year (newest first), one column per week of the year. */
export function buildWeeklyHeatmap(films: EnrichedFilm[]): HeatmapGrid {
	const byWeek = new Map<string, Bucket>();
	let minYear = Infinity;
	let maxYear = -Infinity;
	let maxWeek = 52;

	for (const [day, bucket] of bucketsByDay(films)) {
		const date = toUtcDate(day);
		const year = date.getUTCFullYear();
		const week = weekOfYear(date);
		minYear = Math.min(minYear, year);
		maxYear = Math.max(maxYear, year);
		maxWeek = Math.max(maxWeek, week);
		const key = `${year}:${week}`;
		let agg = byWeek.get(key);
		if (!agg) byWeek.set(key, (agg = { minutes: 0, films: [] }));
		agg.minutes += bucket.minutes;
		agg.films.push(...bucket.films);
	}

	if (!Number.isFinite(minYear)) {
		return {
			rows: [],
			rowLabels: [],
			colLabels: [],
			legend: WEEKLY_LEGEND,
			description: 'Watchtime per week across years',
			empty: true
		};
	}

	const cols = maxWeek + 1;
	const years: number[] = [];
	for (let y = maxYear; y >= minYear; y--) years.push(y);

	const rows = years.map((year) => {
		const yearStart = new Date(Date.UTC(year, 0, 1));
		const weekBase = addDays(yearStart, -daysSinceMonday(yearStart));
		return Array.from({ length: cols }, (_, week): HeatCell => {
			const bucket = byWeek.get(`${year}:${week}`);
			const monday = addDays(weekBase, week * 7);
			return {
				key: `${year}:${week}`,
				label: `Week of ${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]} ${monday.getUTCFullYear()}`,
				minutes: bucket?.minutes ?? 0,
				bin: binOf(bucket, WEEKLY_THRESHOLDS),
				films: bucket?.films ?? []
			};
		});
	});

	return {
		rows,
		rowLabels: years.map(String),
		colLabels: weeklyColLabels(maxYear, cols),
		legend: WEEKLY_LEGEND,
		description: 'Watchtime per week across years',
		empty: !rows.some((row) => row.some((cell) => cell.bin !== null))
	};
}
