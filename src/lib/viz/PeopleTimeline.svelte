<script lang="ts">
	import { formatHours, formatShort, noun } from '$lib/format';
	import { createPicker } from './picker.svelte';
	import PickerList from './PickerList.svelte';
	import Axes from './chart/Axes.svelte';
	import DataTable from './chart/DataTable.svelte';
	import PlotFrame from './chart/PlotFrame.svelte';
	import { extent, MARGIN, niceStep, plotArea } from './chart/plot';
	import {
		buildSeries,
		defaultSelectionKeys,
		personOptions,
		type PersonOption,
		type PersonSeries,
		type SeriesPoint
	} from './peopleTimeline';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	/** Candidate x-axis steps in years. */
	const YEAR_STEPS = [1, 2, 5, 10, 20, 25];
	/** Candidate y-axis steps in hours. */
	const HOUR_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

	let width = $state(0);
	type Hover = { series: PersonSeries; point: SeriesPoint };
	let hover: Hover | null = $state(null);

	const height = $derived(Math.min(420, Math.max(280, width * 0.5)));
	const options = $derived(personOptions(films));
	const picker = createPicker(() => options, defaultSelectionKeys);
	const series = $derived(picker.selected.map((option) => buildSeries(option)));
	const colorVar = picker.color;

	const allPoints = $derived(
		series.flatMap((s) => s.points.map((point) => ({ series: s, point })))
	);

	/** Frozen once, not re-read per render: a line that only ever extends by re-deriving `now`
	    would keep nudging the axis on every reactive pass. */
	const now = Date.now();

	/* Includes `now`, so the axis runs through to today even when the most recent watch was a
	   while ago, rather than stopping cold at the last plotted point. */
	const dateExtent = $derived.by(() => {
		const dates = extent(allPoints.map(({ point }) => Date.parse(point.date)));
		return dates ? { min: dates.min, max: Math.max(dates.max, now) } : { min: 0, max: 0 };
	});

	const yearExtent = $derived(
		allPoints.length === 0
			? { min: 0, max: 1 }
			: {
					min: new Date(dateExtent.min).getUTCFullYear(),
					max: new Date(dateExtent.max).getUTCFullYear()
				}
	);

	const yearStep = $derived(niceStep(yearExtent.max - yearExtent.min, YEAR_STEPS));

	const yearDomain = $derived({
		min: Math.floor(yearExtent.min / yearStep) * yearStep,
		max: Math.max(
			Math.ceil(yearExtent.max / yearStep) * yearStep,
			Math.floor(yearExtent.min / yearStep) * yearStep + yearStep
		)
	});

	const timeDomain = $derived({
		min: Date.UTC(yearDomain.min, 0, 1),
		max: Date.UTC(yearDomain.max, 0, 1)
	});

	const maxHours = $derived(
		series.reduce((max, s) => Math.max(max, s.points[s.points.length - 1]?.cumulativeHours ?? 0), 0)
	);

	const hourStep = $derived(niceStep(maxHours, HOUR_STEPS));

	const hourDomain = $derived(Math.max(hourStep, Math.ceil(maxHours / hourStep) * hourStep));

	const plot = $derived(plotArea(width, height));

	function pxMs(ms: number): number {
		const span = timeDomain.max - timeDomain.min || 1;
		return MARGIN.left + ((ms - timeDomain.min) / span) * plot.w;
	}

	function px(date: string): number {
		return pxMs(Date.parse(date));
	}

	function py(hours: number): number {
		return MARGIN.top + ((hourDomain - hours) / hourDomain) * plot.h;
	}

	const xTicks = $derived.by(() => {
		const ticks: { x: number; label: string }[] = [];
		for (let y = yearDomain.min; y <= yearDomain.max; y += yearStep)
			ticks.push({ x: px(`${y}-01-01`), label: String(y) });
		return ticks;
	});

	const yTicks = $derived.by(() => {
		const ticks: { y: number; label: string }[] = [];
		for (let h = 0; h <= hourDomain; h += hourStep) ticks.push({ y: py(h), label: `${h}h` });
		return ticks;
	});

	/**
	 * Step-after: the total holds flat at its old value right up to the moment of the next watch,
	 * then jumps — an honest picture of a running total, rather than a diagonal implying gradual
	 * viewing between two dates that were often months apart. Extended flat to today at the end,
	 * matching the domain's own extension past the last watch (see `dateExtent` above).
	 */
	function pathFor(s: PersonSeries): string {
		const points = s.points;
		if (points.length === 0) return '';
		const first = points[0];
		let d = `M${px(first.date).toFixed(1)},${py(first.cumulativeHours).toFixed(1)}`;
		for (let i = 1; i < points.length; i++) {
			const x = px(points[i].date).toFixed(1);
			const heldY = py(points[i - 1].cumulativeHours).toFixed(1);
			const y = py(points[i].cumulativeHours).toFixed(1);
			d += ` L${x},${heldY} L${x},${y}`;
		}
		const last = points[points.length - 1];
		d += ` L${pxMs(now).toFixed(1)},${py(last.cumulativeHours).toFixed(1)}`;
		return d;
	}

	const xy = ({ point }: Hover): [number, number] => [px(point.date), py(point.cumulativeHours)];
</script>

<PickerList
	{picker}
	searchId="ptl-search"
	searchLabel="Search actors and directors"
	placeholder="Type a name…"
	optionsAriaLabel="Actors and directors"
>
	{#snippet chipContent(option: PersonOption)}
		{#if option.href}
			<a class="person" href={option.href} target="_blank" rel="noopener">{option.name}</a>
		{:else}
			<span>{option.name}</span>
		{/if}
		<span class="role">{option.role}</span>
	{/snippet}
	{#snippet optionMeta(option: PersonOption)}
		<span class="meta" data-numeric
			>{option.role} · {option.count} {noun(option.count, 'film')}</span
		>
	{/snippet}
</PickerList>

{#if series.length === 0}
	<p class="empty-chart">Select at least one actor or director above to plot their watch time.</p>
{:else if allPoints.length === 0}
	<p class="empty-chart">None of the selected people's films have a known runtime to plot.</p>
{:else}
	<PlotFrame
		bind:width
		{height}
		label="Cumulative hours watched over time for {series.map((s) => s.option.name).join(', ')}"
		points={allPoints}
		{xy}
		bind:hover
	>
		<Axes {width} {height} {yTicks} {xTicks} baseline={py(0)} xLabel="Year" />

		{#each series as s, i (s.option.key)}
			{#if s.points.length > 0}
				<path class="line" d={pathFor(s)} style="stroke: {colorVar(i)}" />
				{@const last = s.points[s.points.length - 1]}
				<circle
					class="end"
					cx={px(last.date)}
					cy={py(last.cumulativeHours)}
					r="4"
					style="fill: {colorVar(i)}"
				/>
			{/if}
		{/each}

		{#if hover}
			{@const [cx, cy] = xy(hover)}
			<circle
				class="dot active"
				{cx}
				{cy}
				r="5"
				style="fill: {colorVar(series.indexOf(hover.series))}"
			/>
		{/if}

		{#snippet tooltip({ series: s, point })}
			<strong>{s.option.name}</strong>
			<div>{point.event.film.name}</div>
			<div data-numeric>
				{formatShort(point.date)} · {formatHours(point.cumulativeHours)} total
			</div>
		{/snippet}
	</PlotFrame>

	<DataTable
		columns={[
			{ label: 'Person' },
			{ label: 'Role' },
			{ label: 'Events plotted', numeric: true },
			{ label: 'Total hours', numeric: true }
		]}
		rows={series}
		key={(s) => s.option.key}
		cells={(s) => [
			s.option.name,
			s.option.role,
			s.points.length,
			formatHours(s.points[s.points.length - 1]?.cumulativeHours ?? 0)
		]}
	/>
{/if}

<style>
	.person {
		color: var(--accent);
		text-decoration: none;
	}
	.person:hover {
		text-decoration: underline;
	}
	.role {
		color: var(--fg-muted);
		font-size: var(--text-2xs);
	}
	.meta {
		color: var(--fg-muted);
		font-size: var(--text-2xs);
		white-space: nowrap;
	}
	.empty-chart {
		color: var(--fg-secondary);
		font-size: var(--text-sm);
	}
	.line {
		fill: none;
		stroke-width: 2.5;
	}
	.end {
		stroke: var(--bg);
		stroke-width: 1.5;
	}
	.dot.active {
		stroke: var(--fg);
		stroke-width: 2;
	}
</style>
