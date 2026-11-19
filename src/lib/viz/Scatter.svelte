<script lang="ts">
	import { count, fixed, formatRuntime } from '$lib/format';
	import { releaseYear } from '$lib/film/release';
	import Axes from './chart/Axes.svelte';
	import DataTable from './chart/DataTable.svelte';
	import PlotFrame from './chart/PlotFrame.svelte';
	import { extent, MARGIN, niceStep, plotArea, STAR_AXIS } from './chart/plot';
	import { runtimeBuckets } from './stats';
	import { describeFit, linearFit, runtimeRatingPoints, type Point } from './scatter';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	/** Candidate x-axis steps in minutes. */
	const TICK_STEPS = [15, 30, 60, 120, 300];

	let width = $state(0);
	let hover: Point | null = $state(null);

	const height = $derived(Math.min(420, Math.max(260, width * 0.5)));
	const points = $derived(runtimeRatingPoints(films));
	const fit = $derived(linearFit(points));

	const runtimes = $derived(extent(points.map((p) => p.runtime)) ?? { min: 0, max: 0 });
	const step = $derived(niceStep(runtimes.max - runtimes.min, TICK_STEPS));
	const domain = $derived({
		min: Math.floor(runtimes.min / step) * step,
		max: Math.max(
			Math.ceil(runtimes.max / step) * step,
			Math.floor(runtimes.min / step) * step + step
		)
	});
	const plot = $derived(plotArea(width, height));

	function px(runtime: number): number {
		const span = domain.max - domain.min || 1;
		return MARGIN.left + ((runtime - domain.min) / span) * plot.w;
	}

	function py(rating: number): number {
		return MARGIN.top + ((STAR_AXIS.max - rating) / (STAR_AXIS.max - STAR_AXIS.min)) * plot.h;
	}

	const xTicks = $derived.by(() => {
		const ticks: { x: number; label: string }[] = [];
		for (let t = domain.min; t <= domain.max; t += step)
			ticks.push({ x: px(t), label: formatRuntime(t) });
		return ticks;
	});
	const yTicks = $derived(
		STAR_AXIS.ticks.map((rating) => ({ y: py(rating), label: String(rating) }))
	);

	/** The fitted line clipped to the plotted runtime range. */
	const trend = $derived.by(() => {
		if (!fit) return null;
		const at = (runtime: number) =>
			Math.min(STAR_AXIS.max, Math.max(STAR_AXIS.min, fit.intercept + fit.slope * runtime));
		return {
			x1: px(domain.min),
			y1: py(at(domain.min)),
			x2: px(domain.max),
			y2: py(at(domain.max))
		};
	});

	const xy = (p: Point): [number, number] => [px(p.runtime), py(p.rating + p.jitter)];

	const summary = $derived(
		fit
			? `Runtime against your rating for ${fit.n} films: r = ${fit.r.toFixed(2)}, ${describeFit(fit)}.`
			: 'Not enough rated films with a known runtime to plot.'
	);
	const bands = $derived(runtimeBuckets(points.map((p) => p.film)));
</script>

<PlotFrame bind:width {height} label={summary} {points} {xy} bind:hover>
	<Axes {width} {height} {yTicks} {xTicks} baseline={py(STAR_AXIS.min)} xLabel="Runtime" />

	{#each points as point (point.film.uri)}
		{@const [cx, cy] = xy(point)}
		<circle class="dot" {cx} {cy} r="4" />
	{/each}

	{#if trend}
		<line class="trend" x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2} />
	{/if}

	{#if hover}
		{@const [cx, cy] = xy(hover)}
		<circle class="dot active" {cx} {cy} r="6" />
	{/if}

	{#snippet tooltip(point)}
		<strong>{point.film.name}</strong>
		<div>
			<span data-numeric>{formatRuntime(point.runtime)}</span>
			· <span data-numeric>★ {point.rating}</span>
			{#if releaseYear(point.film)}
				· <span data-numeric>{releaseYear(point.film)}</span>
			{/if}
		</div>
	{/snippet}
</PlotFrame>

{#if fit}
	<p class="readout">
		r = {fit.r.toFixed(2)} across {count(fit.n)} films:
		{describeFit(fit)}.
	</p>
{/if}

<DataTable
	columns={[
		{ label: 'Runtime' },
		{ label: 'Films', numeric: true },
		{ label: 'Avg rating', numeric: true }
	]}
	rows={bands}
	key={(band) => band.label}
	cells={(band) => [band.label, band.count, fixed(band.avg, 2)]}
/>

<style>
	.dot {
		fill: var(--accent);
		fill-opacity: 0.45;
		stroke: var(--bg);
		stroke-width: 1;
	}
	.dot.active {
		fill-opacity: 1;
		stroke: var(--fg);
		stroke-width: 2;
	}
	.trend {
		stroke: var(--fg);
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
	.readout {
		margin: 8px 0 0;
		font-size: var(--text-md);
	}
</style>
