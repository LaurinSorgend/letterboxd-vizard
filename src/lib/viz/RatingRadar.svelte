<script lang="ts">
	import { fixed } from '$lib/format';
	import DataTable from './chart/DataTable.svelte';
	import Tooltip from './chart/Tooltip.svelte';
	import { createPicker } from './picker.svelte';
	import PickerList from './PickerList.svelte';
	import { radarRows, type RadarRow } from './ratingRadar';
	import { SOURCES } from '$lib/film/ratings';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const MARGIN = { top: 24, right: 16, bottom: 16, left: 16 };
	const TICKS = [0, 25, 50, 75, 100];

	let width = $state(0);
	let hovered: RadarRow | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0 });

	const height = 340;
	const rows = $derived(radarRows(films));
	const options = $derived(
		[...rows]
			.map((r) => ({ key: r.film.uri, name: r.film.name }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const picker = createPicker(() => options);

	/** Selected films get a stable color by selection order; everyone else uses the plain accent. */
	const selectionColor = (row: RadarRow): string | null => picker.colorOf(row.film.uri);

	function isDimmed(row: RadarRow): boolean {
		if (hovered === row) return false;
		if (hovered !== null) return true;
		return picker.selected.length > 0 && !picker.isSelected(row.film.uri);
	}

	const plot = $derived({
		w: Math.max(1, width - MARGIN.left - MARGIN.right),
		h: Math.max(1, height - MARGIN.top - MARGIN.bottom)
	});

	function axisX(index: number): number {
		const span = SOURCES.length - 1;
		return MARGIN.left + (span === 0 ? 0 : (index / span) * plot.w);
	}

	function valueY(value: number): number {
		return MARGIN.top + (1 - value / 100) * plot.h;
	}

	function pointsOf(row: RadarRow): string {
		return row.values
			.map((v, i) => (v === null ? null : `${axisX(i)},${valueY(v)}`))
			.filter((p): p is string => p !== null)
			.join(' ');
	}

	const formatValue = (v: number | null): string => fixed(v, 0);

	function describeRow(row: RadarRow): string {
		return SOURCES.map((axis, i) => `${axis.label} ${formatValue(row.values[i])}`).join(', ');
	}

	function onEnter(row: RadarRow, event: PointerEvent | FocusEvent) {
		hovered = row;
		const target = event.currentTarget as SVGGraphicsElement;
		const box = target.getBoundingClientRect();
		const svgBox = target.ownerSVGElement?.getBoundingClientRect();
		if (svgBox) hoverPos = { x: box.left - svgBox.left + box.width / 2, y: box.top - svgBox.top };
	}
</script>

<PickerList
	{picker}
	searchId="radar-search"
	searchLabel="Highlight specific films"
	placeholder="Type a title…"
	optionsAriaLabel="Films"
/>

<div class="wrap" bind:clientWidth={width}>
	{#if width > 0 && rows.length > 0}
		<svg
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			role="img"
			aria-label="Parallel coordinates comparing your rating against TMDB, IMDb, Rotten Tomatoes and Metacritic, all normalized to 0-100, for {rows.length} films"
		>
			{#each SOURCES as axis, i (axis.key)}
				<line
					class="axis"
					x1={axisX(i)}
					x2={axisX(i)}
					y1={MARGIN.top}
					y2={height - MARGIN.bottom}
				/>
				{#each TICKS as tick (tick)}
					<text class="tick" data-numeric x={axisX(i) + 4} y={valueY(tick)} dy="0.32em">
						{tick}
					</text>
				{/each}
				<text
					class="axis-label"
					x={axisX(i)}
					y={MARGIN.top - 8}
					text-anchor={i === 0 ? 'start' : i === SOURCES.length - 1 ? 'end' : 'middle'}
				>
					{axis.label}
				</text>
			{/each}

			{#each rows as row (row.film.uri)}
				<polyline
					class="line"
					class:dim={isDimmed(row)}
					class:active={hovered === row}
					class:selected={picker.isSelected(row.film.uri)}
					style={selectionColor(row) ? `stroke: ${selectionColor(row)};` : ''}
					points={pointsOf(row)}
					role="button"
					tabindex="0"
					aria-label="{row.film.name}: {describeRow(row)}"
					onpointerenter={(e) => onEnter(row, e)}
					onpointerleave={() => (hovered = null)}
					onfocus={(e) => onEnter(row, e)}
					onblur={() => (hovered = null)}
				/>
			{/each}
		</svg>

		{#if hovered}
			<Tooltip x={hoverPos.x} y={hoverPos.y} frameWidth={width}>
				<strong>{hovered.film.name}</strong>
				<div class="rows">
					{#each SOURCES as axis, i (axis.key)}
						<span>{axis.label}</span>
						<span data-numeric>{formatValue(hovered.values[i])}</span>
					{/each}
				</div>
			</Tooltip>
		{/if}
	{:else}
		<p class="empty">Not enough rated films with an external rating to plot.</p>
	{/if}
</div>

<DataTable
	columns={[
		{ label: 'Film' },
		...SOURCES.map((source) => ({ label: source.label, numeric: true }))
	]}
	rows={[...rows].sort((a, b) => a.film.name.localeCompare(b.film.name))}
	key={(row) => row.film.uri}
	cells={(row) => [{ film: row.film }, ...row.values.map(formatValue)]}
/>

<style>
	.wrap {
		position: relative;
	}
	svg {
		display: block;
		max-width: 100%;
		touch-action: pan-y;
	}
	.axis {
		stroke: var(--border-strong);
	}
	.tick {
		fill: var(--fg-muted);
		font-size: var(--text-2xs);
	}
	.axis-label {
		fill: var(--fg-secondary);
		font-size: var(--text-sm);
	}
	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
		stroke-opacity: 0.35;
		cursor: pointer;
	}
	.line.dim {
		stroke-opacity: 0.06;
	}
	.line.active {
		stroke: var(--fg);
		stroke-opacity: 1;
		stroke-width: 2.5;
	}
	.line.selected {
		stroke-opacity: 1;
		stroke-width: 2.5;
	}
	.line:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.rows {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0 12px;
		margin-top: 4px;
		color: var(--fg-secondary);
	}
	.empty {
		color: var(--fg-muted);
	}
</style>
