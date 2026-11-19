<script lang="ts">
	import FilmList from './FilmList.svelte';
	import RampLegend from './RampLegend.svelte';
	import { selectByKey } from './selection.svelte';
	import { binColor, RATING_RANGE } from './ramp';
	import { formatWatchtime, minuteLabel, noun } from '$lib/format';
	import { cellBin, heatScale, type HeatMetric, type HeatmapGrid, type HeatCell } from './heatmap';

	let {
		grid,
		metric,
		cellSize = 13,
		fitWidth = false
	}: { grid: HeatmapGrid; metric: HeatMetric; cellSize?: number; fitWidth?: boolean } = $props();

	const cols = $derived(grid.rows[0]?.length ?? 0);
	// Grids with few columns can shrink their cells to fit a phone instead of scrolling; ~180px
	// covers the row labels, gaps and page padding that sit beside the cells.
	const cellLength = $derived(
		fitWidth ? `min(${cellSize}px, (100vw - 180px) / ${cols})` : `${cellSize}px`
	);
	const scale = $derived(heatScale(grid, metric));
	/** Rating's fixed endpoints; for watchtime, the grid's actual busiest cell. */
	const legendRange = $derived.by(() => {
		if (metric === 'rating') return RATING_RANGE;
		let max = 0;
		for (const row of grid.rows) {
			for (const cell of row) if (cell && cell.minutes > max) max = cell.minutes;
		}
		return { min: '0', max: minuteLabel(max) };
	});
	const description = $derived(
		`${metric === 'rating' ? 'Average rating' : 'Watchtime'} ${grid.period}`
	);
	const selection = selectByKey(
		() => grid.rows.flat().filter((cell): cell is HeatCell => cell !== null),
		(cell) => cell.key
	);

	/** Fira Code is for numerals; word axes (weekdays, months, genres) keep the UI face. */
	const numeric = (label: string) => /\d/.test(label) || undefined;

	function ratingText(cell: HeatCell): string {
		if (cell.rating === null) return 'no ratings';
		const partial = cell.ratedCount < cell.films.length ? ` (${cell.ratedCount} rated)` : '';
		return `average rating ${cell.rating.toFixed(2)}${partial}`;
	}

	function title(cell: HeatCell): string {
		if (cell.films.length === 0) return `${cell.label}: nothing watched`;
		const count = `${cell.films.length} ${noun(cell.films.length, 'film')}`;
		const value = metric === 'rating' ? ratingText(cell) : formatWatchtime(cell.minutes);
		return `${cell.label}: ${count} · ${value}`;
	}
</script>

<section aria-label={description}>
	{#if grid.empty}
		<p class="empty-msg">No diary entries in this period yet.</p>
	{:else}
		<div class="scroll">
			<div
				class="grid"
				style="--cell: {cellLength}; grid-template-columns: auto repeat({cols}, var(--cell)); grid-template-rows: auto repeat({grid
					.rows.length}, var(--cell));"
			>
				{#each grid.colLabels as label, c (c)}
					{#if label}
						<span
							class="col-label"
							data-numeric={numeric(label)}
							style="grid-row: 1; grid-column: {c + 2};">{label}</span
						>
					{/if}
				{/each}

				{#each grid.rows as row, r (r)}
					{#if grid.rowLabels[r]}
						<span
							class="row-label"
							data-numeric={numeric(grid.rowLabels[r])}
							style="grid-row: {r + 2}; grid-column: 1;">{grid.rowLabels[r]}</span
						>
					{/if}
					{#each row as cell, c (c)}
						{@const pos = `grid-row: ${r + 2}; grid-column: ${c + 2};`}
						{@const bin = cell ? cellBin(cell, metric, scale.thresholds) : null}
						{#if cell === null}
							<span class="pad" style={pos}></span>
						{:else if bin === null}
							<span class="cell empty" style={pos} title={title(cell)}></span>
						{:else}
							<button
								type="button"
								class="cell"
								class:few={bin === 'few'}
								style={pos}
								style:background={bin === 'few' ? undefined : binColor(bin)}
								aria-pressed={selection.isSelected(cell.key)}
								aria-label={title(cell)}
								title={title(cell)}
								onclick={() => selection.toggle(cell.key)}
							></button>
						{/if}
					{/each}
				{/each}
			</div>
		</div>

		<RampLegend
			titles={scale.legend}
			less="Less"
			more="More"
			min={legendRange.min}
			max={legendRange.max}
		>
			{#snippet keys()}
				{#if metric === 'rating'}
					<span><i class="swatch few"></i>no ratings</span>
				{/if}
				<span><i class="swatch none"></i>none</span>
			{/snippet}
		</RampLegend>
	{/if}

	{#if selection.selected}
		{@const selected = selection.selected}
		<FilmList title={selected.label} films={selected.films} />
	{/if}
</section>

<style>
	.scroll {
		overflow-x: auto;
		padding-bottom: 4px;
	}
	.grid {
		display: grid;
		gap: 3px;
		width: max-content;
		align-items: center;
	}
	.col-label,
	.row-label {
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
		white-space: nowrap;
	}
	.col-label {
		align-self: end;
		padding-bottom: 2px;
	}
	.row-label {
		justify-self: end;
		padding-right: 6px;
	}
	.cell {
		width: var(--cell);
		height: var(--cell);
		padding: 0;
		margin: 0;
		border: none;
	}
	button.cell {
		cursor: pointer;
	}
	button.cell:hover {
		filter: brightness(1.15);
	}
	button.cell:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	button.cell[aria-pressed='true'] {
		box-shadow: 0 0 0 1.5px var(--fg);
	}
	.empty {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}
	.few {
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.pad {
		width: var(--cell);
		height: var(--cell);
	}

	.empty-msg {
		font-size: var(--text-base);
		color: var(--fg-secondary);
	}
</style>
