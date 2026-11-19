<script lang="ts">
	import MetricToggle from './MetricToggle.svelte';
	import DataTable from './chart/DataTable.svelte';
	import FilmLink from './chart/FilmLink.svelte';
	import Tooltip from './chart/Tooltip.svelte';
	import { getOrCreate } from '$lib/maps';
	import { releaseYear } from '$lib/film/release';
	import RampLegend from './RampLegend.svelte';
	import { selectByKey } from './selection.svelte';
	import { BIN_COUNT, binColor, HALF_STAR_LABELS, RATING_RANGE } from './ramp';
	import { buildNetwork, NET_HEIGHT, NET_WIDTH, type NetworkNode } from './network';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	/** Minimum pointer target in graph units, so a small node is still comfortably clickable. */
	const HIT_RADIUS = 20;

	let castDepth = $state('10');
	let hover: NetworkNode | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0, frameWidth: 0, above: true });
	let container: HTMLElement | undefined = $state();
	/** Rough tooltip height in px: below this much room above the point, flip it under instead. */
	const TOOLTIP_HEIGHT = 90;

	// Every pair sharing anybody at all counts as a link; the cast-depth toggle is the real filter.
	const graph = $derived(buildNetwork(films, Number(castDepth)));

	/** Keyed by film, not position: the graph reshuffles when castDepth changes. */
	const selection = selectByKey(
		() => graph.nodes,
		(node) => node.film.uri
	);

	/** Index of the selected film in the current graph, or null if unselected or dropped by a rebuild. */
	const selectedIndex = $derived.by(() => {
		const node = selection.selected;
		return node === null ? null : graph.nodes.indexOf(node);
	});

	/** Neighbor lookup shared by every BFS, so re-selecting a node doesn't re-scan all edges. */
	const adjacency = $derived.by(() => {
		const map = new Map<number, number[]>();
		for (const edge of graph.edges) {
			getOrCreate(map, edge.source, () => []).push(edge.target);
			getOrCreate(map, edge.target, () => []).push(edge.source);
		}
		return map;
	});

	/** Hops coloured outward from a selected film, one per bin of the degree ramp. */
	const MAX_DEGREE = BIN_COUNT;
	const ordinal = (n: number): string =>
		`${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
	const DEGREE_LABELS = Array.from({ length: MAX_DEGREE }, (_, i) => ordinal(i + 1));

	const focusDist = $derived.by(() => {
		if (selectedIndex === null) return null;
		const dist = new Map<number, number>([[selectedIndex, 0]]);
		let frontier = [selectedIndex];
		for (let d = 1; d <= MAX_DEGREE && frontier.length > 0; d++) {
			const next: number[] = [];
			for (const index of frontier) {
				for (const neighbor of adjacency.get(index) ?? []) {
					if (!dist.has(neighbor)) {
						dist.set(neighbor, d);
						next.push(neighbor);
					}
				}
			}
			frontier = next;
		}
		return dist;
	});

	function edgeInFocus(edge: { source: number; target: number }): boolean {
		if (focusDist === null) return true;
		return focusDist.has(edge.source) && focusDist.has(edge.target);
	}

	/** For the selected film, who it connects to and which billed people the two share. */
	const connections = $derived.by(() => {
		if (selectedIndex === null) return [];
		return graph.edges
			.filter((edge) => edge.source === selectedIndex || edge.target === selectedIndex)
			.map((edge) => ({
				film: graph.nodes[edge.source === selectedIndex ? edge.target : edge.source].film,
				shared: edge.shared
			}))
			.sort((a, b) => a.film.name.localeCompare(b.film.name));
	});

	function describe(node: NetworkNode): string {
		const released = releaseYear(node.film);
		const year = released ? ` (${released})` : '';
		const rating = node.film.rating !== null ? `, you rated it ${node.film.rating}` : ', unrated';
		return `${node.film.name}${year}${rating}, connected to ${node.degree} films`;
	}

	/** Rating colour normally; while a node is selected, its neighbors switch to a degree colour
	 *  instead, so the ripple outward from the click reads at a glance. The selected node itself
	 *  keeps its rating colour, as the anchor the ripple is measured from. */
	function fillOf(node: NetworkNode, index: number): string {
		const degree = focusDist?.get(index);
		if (focusDist !== null && degree !== undefined && degree > 0)
			return binColor(degree - 1, 'degree');
		return node.bin === null ? 'var(--surface)' : binColor(node.bin);
	}

	/** Anchored above the point by default, flipping below when there isn't room, so it never clips
	 *  against either edge of the frame. */
	function showHover(node: NetworkNode, event: PointerEvent | FocusEvent) {
		if (!container) return;
		const box = container.getBoundingClientRect();
		const scale = box.width / NET_WIDTH;
		const x = event instanceof PointerEvent ? event.clientX - box.left : node.x * scale;
		const y = event instanceof PointerEvent ? event.clientY - box.top : node.y * scale;
		const above = y >= TOOLTIP_HEIGHT;
		hoverPos = { x, y, frameWidth: box.width, above };
		hover = node;
	}

	const tableRows = $derived(
		[...graph.nodes].sort((a, b) => b.degree - a.degree || a.film.name.localeCompare(b.film.name))
	);
</script>

<div class="controls">
	<MetricToggle
		name="net-cast"
		label="Billed cast per film"
		options={[
			{ value: '10', label: 'Top 10' },
			{ value: '20', label: 'Top 20' }
		]}
		bind:value={castDepth}
	/>
</div>

{#if graph.nodes.length === 0}
	<p class="empty">No links at this threshold.</p>
{:else}
	<div class="frame" bind:this={container}>
		<svg
			viewBox="0 0 {NET_WIDTH} {NET_HEIGHT}"
			role="group"
			aria-label="Films joined where they share billed cast or a director"
		>
			<g class="edges">
				{#each graph.edges as edge (`${edge.source}-${edge.target}`)}
					<line
						class="edge shared-{Math.min(3, edge.shared.length)}"
						class:dim={!edgeInFocus(edge)}
						x1={graph.nodes[edge.source].x}
						y1={graph.nodes[edge.source].y}
						x2={graph.nodes[edge.target].x}
						y2={graph.nodes[edge.target].y}
					/>
				{/each}
			</g>
			{#each graph.nodes as node, index (node.film.uri)}
				<g
					class="node"
					class:dim={focusDist !== null && !focusDist.has(index)}
					class:selected={selection.isSelected(node.film.uri)}
					role="button"
					tabindex="0"
					aria-label={describe(node)}
					onpointerenter={(e) => showHover(node, e)}
					onpointerleave={() => (hover = null)}
					onfocus={(e) => showHover(node, e)}
					onblur={() => (hover = null)}
					onclick={() => selection.toggle(node.film.uri)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							selection.toggle(node.film.uri);
						}
					}}
				>
					<circle class="hit" cx={node.x} cy={node.y} r={Math.max(node.r, HIT_RADIUS)} />
					<circle class="dot" style:fill={fillOf(node, index)} cx={node.x} cy={node.y} r={node.r} />
				</g>
			{/each}
		</svg>

		{#if hover}
			<Tooltip
				x={hoverPos.x}
				y={hoverPos.y}
				frameWidth={hoverPos.frameWidth}
				width={190}
				above={hoverPos.above}
			>
				<strong>{hover.film.name}</strong>
				<div>
					{#if releaseYear(hover.film)}<span data-numeric>{releaseYear(hover.film)}</span> ·{/if}
					{#if hover.film.rating !== null}
						<span data-numeric>★ {hover.film.rating}</span> ·
					{/if}
					{hover.degree} connections
				</div>
			</Tooltip>
		{/if}
	</div>

	{#if selectedIndex !== null}
		<RampLegend
			ramp="degree"
			titles={DEGREE_LABELS.map((label) => `${label} degree`)}
			less="Less"
			more="More"
			min={DEGREE_LABELS[0]}
			max={DEGREE_LABELS[DEGREE_LABELS.length - 1]}
		/>
	{:else}
		<RampLegend
			titles={HALF_STAR_LABELS.map((label) => `★ ${label}`)}
			less="Less"
			more="More"
			min={RATING_RANGE.min}
			max={RATING_RANGE.max}
		>
			{#snippet keys()}
				<span><i class="swatch few"></i>unrated</span>
			{/snippet}
		</RampLegend>
	{/if}

	{#if selectedIndex !== null}
		<div class="connections">
			<h3>
				Films connected to {graph.nodes[selectedIndex].film.name}: {connections.length}
			</h3>
			<ul>
				{#each connections as connection (connection.film.uri)}
					<li>
						<FilmLink film={connection.film} />
						<span class="shared">via {connection.shared.join(', ')}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<DataTable
		columns={[
			{ label: 'Film' },
			{ label: 'Connections', numeric: true },
			{ label: 'Your rating', numeric: true }
		]}
		rows={tableRows}
		key={(node) => node.film.uri}
		cells={(node) => [node.film.name, node.degree, node.film.rating ?? '—']}
	/>
{/if}

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
	}
	.frame {
		position: relative;
		margin-top: 8px;
		overflow-x: auto;
	}
	svg {
		display: block;
		width: 100%;
		/* Below this the dots crowd into an unreadable smudge, so the frame scrolls instead. */
		min-width: 640px;
		height: auto;
		touch-action: pan-x pan-y;
	}

	.edge {
		stroke: var(--border-strong);
		vector-effect: non-scaling-stroke;
	}
	.shared-1 {
		stroke-width: 1;
		stroke-opacity: 0.35;
	}
	.shared-2 {
		stroke-width: 1.5;
		stroke-opacity: 0.6;
	}
	.shared-3 {
		stroke-width: 2;
		stroke-opacity: 0.85;
	}

	.hit {
		fill: transparent;
	}
	/* The ring is the page background, so overlapping dots stay countable. */
	.dot {
		stroke: var(--bg);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.node {
		cursor: pointer;
	}
	.node:hover .dot {
		stroke: var(--fg);
	}
	.node:focus-visible {
		outline: none;
	}
	.node:focus-visible .dot {
		stroke: var(--focus);
		stroke-width: 3;
	}
	.node.selected .dot {
		stroke: var(--fg);
		stroke-width: 3;
	}
	.dim {
		opacity: 0.1;
	}

	.empty {
		font-size: var(--text-sm);
		color: var(--fg-muted);
		margin: 8px 0 0;
	}

	.connections {
		margin-top: 12px;
		padding: 12px;
		background: var(--bg-secondary);
	}
	.connections h3 {
		margin: 0 0 8px;
		font-size: var(--text-base);
	}
	.connections ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.connections li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 8px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.connections li:last-child {
		border-bottom: none;
	}
	.connections li > :global(a) {
		color: var(--accent);
		text-decoration: none;
	}
	.connections li > :global(a:hover) {
		text-decoration: underline;
	}
	.connections .shared {
		color: var(--fg-muted);
		font-size: var(--text-2xs);
	}
</style>
