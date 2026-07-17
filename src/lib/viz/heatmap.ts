import { binIndex, RATING_BIN_LABELS, RATING_THRESHOLDS } from './ramp';
import { avgRating } from './stats';
import type { EnrichedFilm } from '$lib/types';

export type HeatMetric = 'watchtime' | 'rating';

/** One cell of a heatmap grid; `films` is empty when nothing was watched that period. */
export interface HeatCell {
	key: string;
	label: string;
	minutes: number;
	rating: number | null;
	ratedCount: number;
	films: EnrichedFilm[];
	/** Watchtime bin fixed by the builder, for grids whose rows carry their own scale. */
	watchtimeBin?: number;
}

/** A rectangular heatmap with sparse row/column labels; bins come from `heatScale`. */
export interface HeatmapGrid {
	rows: (HeatCell | null)[][];
	rowLabels: string[];
	colLabels: string[];
	watchtimeThresholds: number[];
	watchtimeLegend: string[];
	period: string;
	empty: boolean;
}

/** Thresholds and legend labels for `metric`; rating bins are shared with the map. */
export function heatScale(
	grid: HeatmapGrid,
	metric: HeatMetric
): { thresholds: number[]; legend: string[] } {
	if (metric === 'rating') return { thresholds: RATING_THRESHOLDS, legend: RATING_BIN_LABELS };
	return { thresholds: grid.watchtimeThresholds, legend: grid.watchtimeLegend };
}

/** Bin of a cell: null when nothing was watched, 'few' when nothing watched was rated. */
export function cellBin(
	cell: HeatCell,
	metric: HeatMetric,
	thresholds: number[]
): number | 'few' | null {
	if (cell.films.length === 0) return null;
	if (metric === 'watchtime') return cell.watchtimeBin ?? binIndex(cell.minutes, thresholds);
	return cell.rating === null ? 'few' : binIndex(cell.rating, thresholds);
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

/** Unique films by uri, preserving first-seen order (a film logged twice in one period appears once). */
function uniqueByUri(films: EnrichedFilm[]): EnrichedFilm[] {
	const seen = new Set<string>();
	const unique: EnrichedFilm[] = [];
	for (const film of films) {
		if (seen.has(film.uri)) continue;
		seen.add(film.uri);
		unique.push(film);
	}
	return unique;
}

function cellOf(key: string, label: string, bucket: Bucket | undefined): HeatCell {
	const films = uniqueByUri(bucket?.films ?? []);
	return {
		key,
		label,
		minutes: bucket?.minutes ?? 0,
		rating: avgRating(films),
		ratedCount: films.filter((f) => f.rating !== null).length,
		films
	};
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

/**
 * Five roughly even watchtime bins drawn from the non-empty cells, rounded to whole hours.
 * Genre totals scale with library size, so fixed cuts would saturate or starve the ramp.
 */
function watchtimeBins(minutes: number[]): { thresholds: number[]; legend: string[] } {
	const sorted = minutes.filter((m) => m > 0).sort((a, b) => a - b);
	if (sorted.length === 0) return { thresholds: DAILY_THRESHOLDS, legend: DAILY_LEGEND };

	const thresholds: number[] = [];
	for (const q of [0.2, 0.4, 0.6, 0.8]) {
		const value = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
		let hours = Math.max(1, Math.ceil(value / 60));
		while (thresholds.length > 0 && hours * 60 <= thresholds[thresholds.length - 1]) hours++;
		thresholds.push(hours * 60);
	}

	const h = (m: number) => Math.round(m / 60);
	const legend = thresholds.map((t, i) =>
		i === 0 ? `< ${h(t)}h` : `${h(thresholds[i - 1])}–${h(t)}h`
	);
	legend.push(`${h(thresholds[thresholds.length - 1])}h+`);
	return { thresholds, legend };
}

/**
 * How a genre grid colours its cells: `genre` scales each row to its own busiest month,
 * exposing seasonal shape in small genres; `global` scales every row alike, exposing volume.
 */
export type SeasonScale = 'genre' | 'global';

/** Bins each row against its own busiest month, so a quiet genre still spans the ramp. */
function scaleRowsIndependently(rows: HeatCell[][]): void {
	for (const row of rows) {
		const max = Math.max(...row.map((cell) => cell.minutes));
		if (max <= 0) continue;
		const thresholds = [0.2, 0.4, 0.6, 0.8].map((fraction) => fraction * max);
		for (const cell of row) cell.watchtimeBin = binIndex(cell.minutes, thresholds);
	}
}

/** One row per genre (most-watched first), one column per calendar month, every year pooled. */
export function buildSeasonalHeatmap(
	films: EnrichedFilm[],
	scale: SeasonScale = 'genre'
): HeatmapGrid {
	const byCell = new Map<string, Bucket>();
	const watches = new Map<string, number>();

	for (const film of films) {
		const minutes = film.tmdb?.runtime ?? 0;
		for (const date of film.watchedDates) {
			const month = Number.parseInt(date.slice(5, 7), 10) - 1;
			if (!(month >= 0 && month <= 11)) continue;
			for (const genre of new Set(film.tmdb?.genres ?? [])) {
				const key = `${genre}:${month}`;
				let bucket = byCell.get(key);
				if (!bucket) byCell.set(key, (bucket = { minutes: 0, films: [] }));
				bucket.minutes += minutes;
				bucket.films.push(film);
				watches.set(genre, (watches.get(genre) ?? 0) + 1);
			}
		}
	}

	const genres = [...watches]
		.sort(([aName, aCount], [bName, bCount]) => bCount - aCount || aName.localeCompare(bName))
		.map(([genre]) => genre);

	if (genres.length === 0) {
		return {
			rows: [],
			rowLabels: [],
			colLabels: [],
			watchtimeThresholds: DAILY_THRESHOLDS,
			watchtimeLegend: DAILY_LEGEND,
			period: 'per genre and month',
			empty: true
		};
	}

	const rows = genres.map((genre) =>
		MONTHS.map((month, i) =>
			cellOf(`${genre}:${i}`, `${genre} in ${month}`, byCell.get(`${genre}:${i}`))
		)
	);

	// Per-genre rows have no shared numeric scale, so the legend degrades to a bare ramp.
	if (scale === 'genre') {
		scaleRowsIndependently(rows);
		return {
			rows,
			rowLabels: genres,
			colLabels: MONTHS,
			watchtimeThresholds: [],
			watchtimeLegend: ['', '', '', '', 'More'],
			period: 'per genre and month, each genre on its own scale',
			empty: false
		};
	}

	const { thresholds, legend } = watchtimeBins(rows.flat().map((cell) => cell.minutes));
	return {
		rows,
		rowLabels: genres,
		colLabels: MONTHS,
		watchtimeThresholds: thresholds,
		watchtimeLegend: legend,
		period: 'per genre and month, all years pooled',
		empty: false
	};
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
			const cell = cellOf(isoOf(day), dailyLabel(day), byDay.get(isoOf(day)));
			if (cell.films.length > 0) empty = false;
			rows[r][w] = cell;
		}
	}

	// Rows run Mon…Sun; label every other row (Mon, Wed, Fri).
	return {
		rows,
		rowLabels: Array.from({ length: 7 }, (_, r) => (r % 2 === 0 ? WEEKDAYS[(r + 1) % 7] : '')),
		colLabels,
		watchtimeThresholds: DAILY_THRESHOLDS,
		watchtimeLegend: DAILY_LEGEND,
		period: `per day in ${year}`,
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
			watchtimeThresholds: WEEKLY_THRESHOLDS,
			watchtimeLegend: WEEKLY_LEGEND,
			period: 'per week across years',
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
			const monday = addDays(weekBase, week * 7);
			const label = `Week of ${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]} ${monday.getUTCFullYear()}`;
			return cellOf(`${year}:${week}`, label, byWeek.get(`${year}:${week}`));
		});
	});

	return {
		rows,
		rowLabels: years.map(String),
		colLabels: weeklyColLabels(maxYear, cols),
		watchtimeThresholds: WEEKLY_THRESHOLDS,
		watchtimeLegend: WEEKLY_LEGEND,
		period: 'per week across years',
		empty: !rows.some((row) => row.some((cell) => cell.films.length > 0))
	};
}
