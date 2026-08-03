<script lang="ts">
	import FilmList from './FilmList.svelte';
	import {
		cellBin,
		formatWatchtime,
		heatScale,
		minuteLabel,
		type HeatMetric,
		type HeatmapGrid,
		type HeatCell
	} from './heatmap';

	let {
		grid,
		metric = 'watchtime',
		cellSize = 13,
		fitWidth = false
	}: { grid: HeatmapGrid; metric?: HeatMetric; cellSize?: number; fitWidth?: boolean } = $props();

	let selectedKey: string | null = $state(null);

	const cols = $derived(grid.rows[0]?.length ?? 0);
	// Grids with few columns can shrink their cells to fit a phone instead of scrolling; ~180px
	// covers the row labels, gaps and page padding that sit beside the cells.
	const cellLength = $derived(
		fitWidth ? `min(${cellSize}px, (100vw - 180px) / ${cols})` : `${cellSize}px`
	);
	const scale = $derived(heatScale(grid, metric));
	/** The scale's real endpoints, shown next to Less/More: fixed for rating, the grid's actual
	 *  busiest cell for watchtime (bins are quantile cuts, not a round number). */
	const legendRange = $derived.by(() => {
		if (metric === 'rating') return { min: '0.5', max: '5' };
		let max = 0;
		for (const row of grid.rows) {
			for (const cell of row) if (cell && cell.minutes > max) max = cell.minutes;
		}
		return { min: '0', max: minuteLabel(max) };
	});
	const description = $derived(
		`${metric === 'rating' ? 'Average rating' : 'Watchtime'} ${grid.period}`
	);
	const selected = $derived.by(() => {
		if (selectedKey === null) return null;
		for (const row of grid.rows) {
			for (const cell of row) if (cell?.key === selectedKey) return cell;
		}
		return null;
	});

	/** Fira Code is for numerals; word axes (weekdays, months, genres) keep the UI face. */
	const numeric = (label: string) => /\d/.test(label) || undefined;

	function toggle(cell: HeatCell) {
		if (cell.films.length === 0) return;
		selectedKey = selectedKey === cell.key ? null : cell.key;
	}

	function ratingText(cell: HeatCell): string {
		if (cell.rating === null) return 'no ratings';
		const partial = cell.ratedCount < cell.films.length ? ` (${cell.ratedCount} rated)` : '';
		return `average rating ${cell.rating.toFixed(2)}${partial}`;
	}

	function title(cell: HeatCell): string {
		if (cell.films.length === 0) return `${cell.label}: nothing watched`;
		const count = `${cell.films.length} film${cell.films.length === 1 ? '' : 's'}`;
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
								class="cell {bin === 'few' ? 'few' : `bin-${bin}`}"
								style={pos}
								aria-pressed={selectedKey === cell.key}
								aria-label={title(cell)}
								title={title(cell)}
								onclick={() => toggle(cell)}
							></button>
						{/if}
					{/each}
				{/each}
			</div>
		</div>

		<div class="legend" aria-hidden="true">
			<span class="less">Less <span data-numeric>({legendRange.min})</span></span>
			<span class="scale">
				{#each scale.legend as label, i (i)}
					<i class="swatch bin-{i}" title={label}></i>
				{/each}
			</span>
			<span class="more">More <span data-numeric>({legendRange.max})</span></span>
			{#if metric === 'rating'}
				<span class="key"><i class="swatch few"></i>no ratings</span>
			{/if}
			<span class="key"><i class="swatch empty"></i>none</span>
		</div>
	{/if}

	{#if selected}
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
	.bin-0 {
		background: var(--map-bin-0);
	}
	.bin-1 {
		background: var(--map-bin-1);
	}
	.bin-2 {
		background: var(--map-bin-2);
	}
	.bin-3 {
		background: var(--map-bin-3);
	}
	.bin-4 {
		background: var(--map-bin-4);
	}
	.bin-5 {
		background: var(--map-bin-5);
	}
	.bin-6 {
		background: var(--map-bin-6);
	}
	.bin-7 {
		background: var(--map-bin-7);
	}
	.bin-8 {
		background: var(--map-bin-8);
	}
	.bin-9 {
		background: var(--map-bin-9);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
	}
	.legend .key {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.less,
	.more {
		color: var(--fg-muted);
	}
	.scale {
		display: inline-flex;
		gap: 2px;
	}
	.swatch {
		width: 13px;
		height: 13px;
		display: inline-block;
	}
	.swatch.empty,
	.swatch.few {
		border: 1px solid var(--border);
	}
	.empty-msg {
		font-size: var(--text-base);
		color: var(--fg-secondary);
	}
</style>
