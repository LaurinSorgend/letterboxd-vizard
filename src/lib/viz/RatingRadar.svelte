<script lang="ts">
	import { webHref } from './href';
	import { colorVar as paletteColorVar, filterOptions, toggleSelection } from './picker';
	import PickerList from './PickerList.svelte';
	import { RADAR_AXES, radarRows, type RadarRow } from './ratingRadar';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const MARGIN = { top: 24, right: 16, bottom: 16, left: 16 };
	const TICKS = [0, 25, 50, 75, 100];
	const SEARCH_LIMIT = 40;
	const MAX_SELECTED = 8;
	/** Contrast-sorted, same idea as PeopleTimeline's palette: distinct at a glance against Latte and Mocha alike. */
	const PALETTE = [
		'--ctp-mauve',
		'--ctp-teal',
		'--ctp-sapphire',
		'--ctp-maroon',
		'--ctp-peach',
		'--ctp-flamingo',
		'--ctp-sky',
		'--ctp-lavender'
	];

	let width = $state(0);
	let hovered: RadarRow | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0 });
	let search = $state('');
	let selectedKeys: string[] = $state([]);

	const height = 340;
	const rows = $derived(radarRows(films));
	const dropped = $derived(films.filter((f) => f.rating !== null).length - rows.length);
	const selectedSet = $derived(new Set(selectedKeys));
	const atCap = $derived(selectedKeys.length >= MAX_SELECTED);

	const options = $derived(
		[...rows]
			.map((r) => ({ key: r.film.uri, name: r.film.name }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const filtered = $derived(filterOptions(options, search, SEARCH_LIMIT));
	const listRows = $derived(filtered.rows);
	const listOverflow = $derived(filtered.overflow);
	const chips = $derived(
		selectedKeys
			.map((key) => options.find((o) => o.key === key))
			.filter((o): o is { key: string; name: string } => o !== undefined)
	);

	function toggle(key: string) {
		selectedKeys = toggleSelection(selectedKeys, key, atCap);
	}

	function colorVar(index: number): string {
		return paletteColorVar(PALETTE, index);
	}

	/** Selected films get a stable color by selection order; everyone else uses the plain accent. */
	function selectionColor(row: RadarRow): string | null {
		const index = selectedKeys.indexOf(row.film.uri);
		return index === -1 ? null : colorVar(index);
	}

	function isDimmed(row: RadarRow): boolean {
		if (hovered === row) return false;
		if (hovered !== null) return true;
		return selectedSet.size > 0 && !selectedSet.has(row.film.uri);
	}

	const plot = $derived({
		w: Math.max(1, width - MARGIN.left - MARGIN.right),
		h: Math.max(1, height - MARGIN.top - MARGIN.bottom)
	});

	function axisX(index: number): number {
		const span = RADAR_AXES.length - 1;
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

	function formatValue(v: number | null): string {
		return v === null ? '—' : v.toFixed(0);
	}

	function describeRow(row: RadarRow): string {
		return RADAR_AXES.map((axis, i) => `${axis.label} ${formatValue(row.values[i])}`).join(', ');
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
	searchId="radar-search"
	searchLabel="Highlight specific films"
	placeholder="Type a title…"
	bind:search
	{chips}
	{listRows}
	{listOverflow}
	{atCap}
	maxSelected={MAX_SELECTED}
	capNoun="films"
	optionsAriaLabel="Films"
	isSelected={(key) => selectedSet.has(key)}
	{toggle}
	{colorVar}
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
			{#each RADAR_AXES as axis, i (axis.key)}
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
					text-anchor={i === 0 ? 'start' : i === RADAR_AXES.length - 1 ? 'end' : 'middle'}
				>
					{axis.label}
				</text>
			{/each}

			{#each rows as row (row.film.uri)}
				<polyline
					class="line"
					class:dim={isDimmed(row)}
					class:active={hovered === row}
					class:selected={selectedSet.has(row.film.uri)}
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
			<div class="tooltip" style="left: {hoverPos.x}px; top: {hoverPos.y}px">
				<strong>{hovered.film.name}</strong>
				<div class="rows">
					{#each RADAR_AXES as axis, i (axis.key)}
						<span>{axis.label}</span>
						<span data-numeric>{formatValue(hovered.values[i])}</span>
					{/each}
				</div>
			</div>
		{/if}
	{:else}
		<p class="empty">Not enough rated films with an external rating to plot.</p>
	{/if}
</div>
<p class="note">
	Every axis on a 0-100 scale: your stars ×20, TMDB and IMDb ×10, Rotten Tomatoes and Metacritic as
	given. A line skips straight past any axis that film has no rating for.
	{#if dropped > 0}
		{dropped} rated films left out for lacking every external source.
	{/if}
</p>

<details>
	<summary>View as table</summary>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th>Film</th>
					{#each RADAR_AXES as axis (axis.key)}
						<th class="num">{axis.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each [...rows].sort( (a, b) => a.film.name.localeCompare(b.film.name) ) as row (row.film.uri)}
					<tr>
						<td>
							{#if webHref(row.film.uri)}
								<a href={webHref(row.film.uri)} target="_blank" rel="noopener">{row.film.name}</a>
							{:else}
								{row.film.name}
							{/if}
						</td>
						{#each row.values as v, i (RADAR_AXES[i].key)}
							<td class="num" data-numeric>{formatValue(v)}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</details>

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
	.tooltip {
		position: absolute;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		font-size: var(--text-sm);
		pointer-events: none;
		z-index: 1;
	}
	.tooltip .rows {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0 12px;
		margin-top: 4px;
		color: var(--fg-secondary);
	}
	.empty {
		color: var(--fg-muted);
	}
	.note {
		margin: 4px 0 0;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	details {
		margin-top: 12px;
	}
	summary {
		cursor: pointer;
		color: var(--fg-secondary);
		font-size: var(--text-sm);
	}
	.scroll {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		margin-top: 8px;
		font-size: var(--text-sm);
		width: 100%;
	}
	th,
	td {
		padding: 4px 12px;
		border-bottom: 1px solid var(--border);
		text-align: left;
		white-space: nowrap;
	}
	thead tr {
		background: var(--bg-secondary);
	}
	.num {
		text-align: right;
	}
</style>
