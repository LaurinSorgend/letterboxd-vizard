import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import {
	bucketsByDay,
	buildDailyHeatmap,
	buildSeasonalHeatmap,
	buildWeeklyHeatmap,
	cellBin,
	heatScale,
	type HeatCell,
	type HeatmapGrid
} from './heatmap';

const cells = (grid: HeatmapGrid): HeatCell[] =>
	grid.rows.flat().filter((cell): cell is HeatCell => cell !== null);
const cellAt = (grid: HeatmapGrid, key: string) => cells(grid).find((cell) => cell.key === key);

describe('daily heatmap', () => {
	const movie = film({ rating: 4, tmdb: tmdb({ runtime: 100 }), ...watched(['2026-03-02']) });

	it('has a cell for every day of the year and none outside it', () => {
		const grid = buildDailyHeatmap(bucketsByDay([movie]), 2026);
		const days = cells(grid);
		expect(days).toHaveLength(365);
		expect(days.every((cell) => cell.key.startsWith('2026-'))).toBe(true);
		expect(grid.rows).toHaveLength(7);
	});

	it('keeps the column of a 31 December that falls on a Monday', () => {
		// 31 Dec 2029 is a Monday.
		expect(cellAt(buildDailyHeatmap(new Map(), 2029), '2029-12-31')).toBeDefined();
	});

	it('sums the runtime and averages the rating of the day', () => {
		const other = film({ rating: 2, tmdb: tmdb({ runtime: 50 }), ...watched(['2026-03-02']) });
		const day = cellAt(buildDailyHeatmap(bucketsByDay([movie, other]), 2026), '2026-03-02')!;
		expect(day.minutes).toBe(150);
		expect(day.rating).toBe(3);
		expect(day.films).toHaveLength(2);
	});

	it('is empty in a year with no diary entries', () => {
		expect(buildDailyHeatmap(bucketsByDay([movie]), 2025).empty).toBe(true);
	});

	it('counts a series as no watchtime, since its runtime is the whole run', () => {
		const series = film({
			tmdb: tmdb({ mediaType: 'tv', runtime: 1200 }),
			...watched(['2026-03-03'])
		});
		const day = cellAt(buildDailyHeatmap(bucketsByDay([series]), 2026), '2026-03-03')!;
		expect(day.minutes).toBe(0);
		expect(day.films).toHaveLength(1);
	});
});

describe('weekly heatmap', () => {
	it('has one row per year, newest first, and lists a film rewatched in a week once', () => {
		const movie = film({ tmdb: tmdb({ runtime: 90 }), ...watched(['2024-06-03', '2024-06-04']) });
		const later = film({ tmdb: tmdb({ runtime: 90 }), ...watched(['2026-01-05']) });
		const grid = buildWeeklyHeatmap(bucketsByDay([movie, later]));
		expect(grid.rowLabels).toEqual(['2026', '2025', '2024']);
		const week = cells(grid).find((cell) => cell.films.length > 0 && cell.key.startsWith('2024'))!;
		expect(week.minutes).toBe(180);
		expect(week.films).toEqual([movie]);
	});

	it('is empty with no diary entries', () => {
		expect(buildWeeklyHeatmap(new Map()).empty).toBe(true);
	});
});

describe('seasonal heatmap', () => {
	const films = [
		film({ tmdb: tmdb({ genres: ['Drama'], runtime: 100 }), ...watched(['2025-01-10']) }),
		film({ tmdb: tmdb({ genres: ['Drama'], runtime: 100 }), ...watched(['2025-02-10']) }),
		film({ tmdb: tmdb({ genres: ['Horror'], runtime: 600 }), ...watched(['2025-10-10']) })
	];

	it('puts the most-watched genre first, with a column per month', () => {
		const grid = buildSeasonalHeatmap(films, 'global');
		expect(grid.rowLabels).toEqual(['Drama', 'Horror']);
		expect(grid.colLabels).toHaveLength(12);
	});

	it('lets a quiet genre reach the top of its own scale', () => {
		const grid = buildSeasonalHeatmap(films, 'genre');
		const { thresholds } = heatScale(grid, 'watchtime');
		const drama = grid.rows[0].map((cell) => cellBin(cell!, 'watchtime', thresholds));
		const horror = grid.rows[1].map((cell) => cellBin(cell!, 'watchtime', thresholds));
		expect(Math.max(...drama.filter((b): b is number => typeof b === 'number'))).toBe(
			Math.max(...horror.filter((b): b is number => typeof b === 'number'))
		);
	});

	it('bins every genre against one scale when asked', () => {
		const grid = buildSeasonalHeatmap(films, 'global');
		const { thresholds } = heatScale(grid, 'watchtime');
		const jan = cellBin(grid.rows[0][0]!, 'watchtime', thresholds) as number;
		const oct = cellBin(grid.rows[1][9]!, 'watchtime', thresholds) as number;
		expect(oct).toBeGreaterThan(jan);
	});
});

describe('cellBin', () => {
	const grid = buildDailyHeatmap(
		bucketsByDay([film({ rating: null, tmdb: tmdb({ runtime: 95 }), ...watched(['2026-03-02']) })]),
		2026
	);

	it('leaves a day with nothing watched unbinned', () => {
		const { thresholds } = heatScale(grid, 'rating');
		expect(cellBin(cellAt(grid, '2026-03-01')!, 'rating', thresholds)).toBeNull();
	});

	it("marks a watched day with no ratings as 'few' on the rating scale", () => {
		const { thresholds } = heatScale(grid, 'rating');
		expect(cellBin(cellAt(grid, '2026-03-02')!, 'rating', thresholds)).toBe('few');
	});

	it('bins a day of watchtime on a fixed scale, whatever the rest of the year holds', () => {
		const day = (runtime: number, date: string) =>
			film({ tmdb: tmdb({ runtime }), ...watched([date]) });
		const binOn = (grid: HeatmapGrid, key: string) =>
			cellBin(cellAt(grid, key)!, 'watchtime', heatScale(grid, 'watchtime').thresholds) as number;
		const alone = buildDailyHeatmap(bucketsByDay([day(95, '2026-03-02')]), 2026);
		const busy = buildDailyHeatmap(
			bucketsByDay([day(95, '2026-03-02'), day(600, '2026-03-03'), day(20, '2026-03-04')]),
			2026
		);
		expect(binOn(busy, '2026-03-02')).toBe(binOn(alone, '2026-03-02'));
		expect(binOn(busy, '2026-03-03')).toBeGreaterThan(binOn(busy, '2026-03-02'));
		expect(binOn(busy, '2026-03-04')).toBeLessThan(binOn(busy, '2026-03-02'));
	});
});
