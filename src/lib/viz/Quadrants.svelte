<script lang="ts">
	import {
		hiddenGems,
		QUADRANT_LABELS,
		quadrantPoints,
		quadrantSummaries,
		type QuadrantPoint
	} from './quadrants';
	import { count, fixed, formatPopularity } from '$lib/format';
	import { releaseYear } from '$lib/film/release';
	import Axes from './chart/Axes.svelte';
	import DataTable from './chart/DataTable.svelte';
	import FilmLink from './chart/FilmLink.svelte';
	import PlotFrame from './chart/PlotFrame.svelte';
	import { extent, MARGIN, plotArea, STAR_AXIS } from './chart/plot';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	let width = $state(0);
	let hover: QuadrantPoint | null = $state(null);

	const height = $derived(Math.min(460, Math.max(280, width * 0.55)));
	const result = $derived(quadrantPoints(films));
	const points = $derived(result.points);
	const axes = $derived(result.axes);
	const gems = $derived(hiddenGems(points));
	const summaries = $derived(quadrantSummaries(points));

	/* Vote counts span orders of magnitude, so the x-axis works in log10 decades. */
	const domain = $derived.by(() => {
		const votes = extent(points.map((p) => p.popularity)) ?? { min: 1, max: 10 };
		const min = Math.floor(Math.log10(Math.max(1, votes.min)));
		const max = Math.max(Math.ceil(Math.log10(Math.max(1, votes.max))), min + 1);
		return { min, max };
	});
	const plot = $derived(plotArea(width, height));

	function px(popularity: number): number {
		const span = domain.max - domain.min || 1;
		return MARGIN.left + ((Math.log10(Math.max(1, popularity)) - domain.min) / span) * plot.w;
	}

	function py(rating: number): number {
		return MARGIN.top + ((STAR_AXIS.max - rating) / (STAR_AXIS.max - STAR_AXIS.min)) * plot.h;
	}

	const xTicks = $derived.by(() => {
		const ticks: { x: number; label: string }[] = [];
		for (let decade = domain.min; decade <= domain.max; decade++)
			ticks.push({ x: px(10 ** decade), label: formatPopularity(10 ** decade) });
		return ticks;
	});
	const yTicks = $derived(
		STAR_AXIS.ticks.map((rating) => ({ y: py(rating), label: String(rating) }))
	);

	const medianX = $derived(px(axes.popularityMedian));
	const thresholdY = $derived(py(axes.ratingThreshold));
	const bottom = $derived(py(STAR_AXIS.min));

	const xy = (p: QuadrantPoint): [number, number] => [px(p.popularity), py(p.rating + p.jitter)];

	const summary = $derived(
		points.length > 0
			? `${points.length} rated films split at a popularity median of ` +
					`${count(axes.popularityMedian)} combined TMDB + IMDb votes, and at ` +
					`${axes.ratingThreshold}★ for loved vs. not.`
			: 'Not enough rated, vote-matched films to plot.'
	);
</script>

<PlotFrame bind:width {height} label={summary} {points} {xy} bind:hover>
	<Axes
		{width}
		{height}
		{yTicks}
		{xTicks}
		baseline={bottom}
		xLabel="TMDB + IMDb vote count (log scale)"
	/>

	<line class="median" x1={medianX} x2={medianX} y1={MARGIN.top} y2={bottom} />
	<line class="median" x1={MARGIN.left} x2={width - MARGIN.right} y1={thresholdY} y2={thresholdY} />

	<text class="quadrant-label" x={MARGIN.left + 6} y={MARGIN.top + 14}>
		{QUADRANT_LABELS['obscure-loved']}
	</text>
	<text class="quadrant-label" x={width - MARGIN.right - 6} y={MARGIN.top + 14} text-anchor="end">
		{QUADRANT_LABELS['popular-loved']}
	</text>
	<text class="quadrant-label" x={MARGIN.left + 6} y={bottom - 8}>
		{QUADRANT_LABELS['obscure-disliked']}
	</text>
	<text class="quadrant-label" x={width - MARGIN.right - 6} y={bottom - 8} text-anchor="end">
		{QUADRANT_LABELS['popular-disliked']}
	</text>

	{#each points as point (point.film.uri)}
		{@const [cx, cy] = xy(point)}
		<circle class="dot" {cx} {cy} r="4" />
	{/each}

	{#if hover}
		{@const [cx, cy] = xy(hover)}
		<circle class="dot active" {cx} {cy} r="6" />
	{/if}

	{#snippet tooltip(point)}
		<strong>{point.film.name}</strong>
		<div>
			<span data-numeric>★ {point.rating}</span>
			· <span data-numeric>{count(point.popularity)} votes</span>
			{#if releaseYear(point.film)}
				· <span data-numeric>{releaseYear(point.film)}</span>
			{/if}
		</div>
	{/snippet}
</PlotFrame>

<p class="readout">{summary}</p>

{#if gems.length > 0}
	<div class="gems">
		<h3>Your hidden gems</h3>
		<ul>
			{#each gems as gem (gem.film.uri)}
				<li>
					<FilmLink film={gem.film} class="name" />
					<span class="nums" data-numeric>
						★ <strong>{gem.rating}</strong> · {count(gem.popularity)} votes
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<DataTable
	columns={[
		{ label: 'Quadrant' },
		{ label: 'Films', numeric: true },
		{ label: 'Avg rating', numeric: true }
	]}
	rows={summaries}
	key={(row) => row.quadrant}
	cells={(row) => [row.label, row.count, fixed(row.avgRating, 2)]}
/>

<style>
	.median {
		stroke: var(--border-strong);
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
	}
	.quadrant-label {
		fill: var(--fg-muted);
		font-size: var(--text-2xs);
	}
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
	.readout {
		margin: 8px 0 0;
		font-size: var(--text-md);
	}
	.gems {
		margin-top: 16px;
	}
	.gems h3 {
		margin: 0 0 4px;
	}
	.gems ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.gems li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.gems :global(.name) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--accent);
		text-decoration: none;
	}
	.gems :global(.name:hover) {
		text-decoration: underline;
	}
	.nums {
		color: var(--fg-secondary);
		white-space: nowrap;
	}
</style>
