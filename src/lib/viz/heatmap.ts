import { binIndex, HALF_STAR_RANGE_LABELS, HALF_STAR_THRESHOLDS } from './ramp';
import { avgRating } from './stats';
import { getOrCreate } from '$lib/collections';
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
	if (metric === 'rating')
		return { thresholds: HALF_STAR_THRESHOLDS, legend: HALF_STAR_RANGE_LABELS };
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

/** Compact minutes/hours label, e.g. `45m`, `2h`, `2.5h`; used for cell tooltips and legend ends. */
export function minuteLabel(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	return minutes % 60 === 0 ? `${minutes / 60}h` : `${(minutes / 60).toFixed(1)}h`;
}

/** Range labels for fixed (non-quantile) watchtime thresholds, one bin per gap plus an open top. */
function fixedWatchtimeLegend(thresholds: number[]): string[] {
	const legend = thresholds.map((t, i) =>
		i === 0 ? `< ${minuteLabel(t)}` : `${minuteLabel(thresholds[i - 1])}–${minuteLabel(t)}`
	);
	legend.push(`${minuteLabel(thresholds[thresholds.length - 1])}+`);
	return legend;
}

/* Watchtime bins in minutes; index i = value >= threshold[i-1]. Map colors reused. */
const DAILY_THRESHOLDS = [30, 60, 90, 120, 150, 180, 240, 300, 360];
const DAILY_LEGEND = fixedWatchtimeLegend(DAILY_THRESHOLDS);
const WEEKLY_THRESHOLDS = [90, 180, 300, 420, 570, 720, 900, 1080, 1290];
const WEEKLY_LEGEND = fixedWatchtimeLegend(WEEKLY_THRESHOLDS);

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Bucket {
	minutes: number;
	films: EnrichedFilm[];
}

function emptyBucket(): Bucket {
	return { minutes: 0, films: [] };
}

/** Watch buckets keyed by calendar day (YYYY-MM-DD); the daily and weekly grids share one. */
export type DayBuckets = Map<string, Bucket>;

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

/** The YYYY-MM-DD day of a diary date, or null when the date is too short to read. */
function diaryDay(date: string): string | null {
	const day = date.slice(0, 10);
	return day.length === 10 ? day : null;
}

/**
 * Minutes one diary entry adds to the calendar period it lands in. A series' runtime spans its
 * whole run rather than the day it was logged, so it contributes none.
 */
function periodMinutes(film: EnrichedFilm): number {
	if (film.tmdb?.mediaType === 'tv') return 0;
	return film.tmdb?.runtime ?? 0;
}

/** Sum each diary watch's runtime into its calendar day (YYYY-MM-DD). */
export function bucketsByDay(films: EnrichedFilm[]): DayBuckets {
	const days = new Map<string, Bucket>();
	for (const film of films) {
		const minutes = periodMinutes(film);
		for (const date of film.watchedDates) {
			const day = diaryDay(date);
			if (day === null) continue;
			const bucket = getOrCreate(days, day, emptyBucket);
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

/* Nine cuts give the ten bins the map colors provide (--map-bin-0…9). */
const QUANTILES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

/** The nine quantile cuts of `minutes`, ignoring periods with nothing to measure. */
function quantileCuts(minutes: number[]): number[] {
	const sorted = minutes.filter((m) => m > 0).sort((a, b) => a - b);
	if (sorted.length === 0) return [];
	return QUANTILES.map((q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]);
}

/**
 * Ten roughly even watchtime bins drawn from the non-empty cells, rounded to whole hours.
 * Genre totals scale with library size, so fixed cuts would saturate or starve the ramp.
 */
function watchtimeBins(minutes: number[]): { thresholds: number[]; legend: string[] } {
	const cuts = quantileCuts(minutes);
	if (cuts.length === 0) return { thresholds: DAILY_THRESHOLDS, legend: DAILY_LEGEND };

	const thresholds: number[] = [];
	let hours = 0;
	for (const cut of cuts) {
		hours = Math.max(hours + 1, Math.ceil(cut / 60));
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

type GridScale = Pick<HeatmapGrid, 'watchtimeThresholds' | 'watchtimeLegend'>;

/**
 * Bins each row against its own months, so a quiet genre still spans the ramp. Rows sharing no
 * numeric scale leaves the grid no thresholds worth publishing, hence the bare-ramp legend; the
 * bins live on the cells instead, and every cell gets one.
 */
function scaleRowsIndependently(rows: HeatCell[][]): GridScale {
	for (const row of rows) {
		const thresholds = quantileCuts(row.map((cell) => cell.minutes));
		for (const cell of row) cell.watchtimeBin = binIndex(cell.minutes, thresholds);
	}
	return { watchtimeThresholds: [], watchtimeLegend: ['', '', '', '', '', '', '', '', '', 'More'] };
}

/** Bins every row against one scale drawn from the whole grid. */
function scaleGridTogether(rows: HeatCell[][]): GridScale {
	const { thresholds, legend } = watchtimeBins(rows.flat().map((cell) => cell.minutes));
	return { watchtimeThresholds: thresholds, watchtimeLegend: legend };
}

/** One row per genre (most-watched first), one column per calendar month, every year pooled. */
export function buildSeasonalHeatmap(
	films: EnrichedFilm[],
	scale: SeasonScale = 'genre'
): HeatmapGrid {
	const byCell = new Map<string, Bucket>();
	const watches = new Map<string, number>();

	for (const film of films) {
		const minutes = periodMinutes(film);
		const genresOf = new Set(film.tmdb?.genres ?? []);
		for (const date of film.watchedDates) {
			const day = diaryDay(date);
			if (day === null) continue;
			const month = Number.parseInt(day.slice(5, 7), 10) - 1;
			if (!(month >= 0 && month <= 11)) continue;
			for (const genre of genresOf) {
				const key = `${genre}:${month}`;
				const bucket = getOrCreate(byCell, key, emptyBucket);
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

	return {
		rows,
		rowLabels: genres,
		colLabels: MONTHS,
		...(scale === 'genre' ? scaleRowsIndependently(rows) : scaleGridTogether(rows)),
		period:
			scale === 'genre'
				? 'per genre and month, each genre on its own scale'
				: 'per genre and month, all years pooled',
		empty: false
	};
}

/** GitHub-style calendar: 7 weekday rows × week columns for one year. */
export function buildDailyHeatmap(byDay: DayBuckets, year: number): HeatmapGrid {
	const jan1 = new Date(Date.UTC(year, 0, 1));
	const dec31 = new Date(Date.UTC(year, 11, 31));
	const start = addDays(jan1, -daysSinceMonday(jan1));
	// Size inclusively: Dec 31 lands in floor(weeks) when it is itself a Monday, so +1 keeps its column.
	const cols = Math.floor((dec31.getTime() - start.getTime()) / DAY_MS / 7) + 1;

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
export function buildWeeklyHeatmap(byDay: DayBuckets): HeatmapGrid {
	const byWeek = new Map<string, Bucket>();
	let minYear = Infinity;
	let maxYear = -Infinity;
	let maxWeek = 52;

	for (const [day, bucket] of byDay) {
		const date = toUtcDate(day);
		const year = date.getUTCFullYear();
		const week = weekOfYear(date);
		minYear = Math.min(minYear, year);
		maxYear = Math.max(maxYear, year);
		maxWeek = Math.max(maxWeek, week);
		const key = `${year}:${week}`;
		const agg = getOrCreate(byWeek, key, emptyBucket);
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
