<script lang="ts">
	import MetricToggle from './MetricToggle.svelte';
	import { webHref } from './href';
	import { HALF_STAR_LABELS } from './ramp';
	import { buildNetwork, NET_HEIGHT, NET_WIDTH, type NetworkNode } from './network';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	/** Past this many nodes the picture stops being readable, whatever the thresholds. */
	const MAX_NODES = 150;
	/** Minimum pointer target in graph units, so a small node is still comfortably clickable. */
	const HIT_RADIUS = 20;
	/** Every pair sharing anybody at all counts as a link; the cast-depth toggle is the real filter. */
	const MIN_SHARED = 1;

	let castDepth = $state('10');
	let selected: number | null = $state(null);
	let hover: NetworkNode | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0, above: true });
	let container: HTMLElement | undefined = $state();
	/** Rough tooltip height in px: below this much room above the point, flip it under instead. */
	const TOOLTIP_HEIGHT = 90;

	const graph = $derived(
		buildNetwork(films, {
			castDepth: Number(castDepth),
			minShared: MIN_SHARED,
			maxNodes: MAX_NODES
		})
	);

	/** Neighbor lookup shared by every BFS, so re-selecting a node doesn't re-scan all edges. */
	const adjacency = $derived.by(() => {
		const map = new Map<number, number[]>();
		for (const edge of graph.edges) {
			(map.get(edge.source) ?? map.set(edge.source, []).get(edge.source)!).push(edge.target);
			(map.get(edge.target) ?? map.set(edge.target, []).get(edge.target)!).push(edge.source);
		}
		return map;
	});

	const MAX_DEGREE = 10;
	const DEGREE_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

	/** Hop distance from the selected node, out to `MAX_DEGREE`; the selected node itself is 0. */
	const focusDist = $derived.by(() => {
		if (selected === null) return null;
		const dist = new Map<number, number>([[selected, 0]]);
		let frontier = [selected];
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

	/** Whether an edge sits between two nodes both still within `MAX_DEGREE` of the selection. */
	function edgeInFocus(edge: { source: number; target: number }): boolean {
		if (focusDist === null) return true;
		return focusDist.has(edge.source) && focusDist.has(edge.target);
	}

	/** For the selected film, who it connects to and which billed people the two share. */
	const connections = $derived.by(() => {
		if (selected === null) return [];
		return graph.edges
			.filter((edge) => edge.source === selected || edge.target === selected)
			.map((edge) => ({
				film: graph.nodes[edge.source === selected ? edge.target : edge.source].film,
				shared: edge.shared
			}))
			.sort((a, b) => a.film.name.localeCompare(b.film.name));
	});

	function describe(node: NetworkNode): string {
		const year = node.film.tmdb?.year ? ` (${node.film.tmdb.year})` : '';
		const rating = node.film.rating !== null ? `, you rated it ${node.film.rating}` : ', unrated';
		return `${node.film.name}${year}${rating}, connected to ${node.degree} films`;
	}

	/** Rating colour normally; while a node is selected, its neighbors switch to a degree colour
	 *  instead, so the ripple outward from the click reads at a glance. The selected node itself
	 *  keeps its rating colour, as the anchor the ripple is measured from. */
	function fillClass(node: NetworkNode, index: number): string {
		const degree = focusDist?.get(index);
		if (focusDist !== null && degree !== undefined && degree > 0) return `degree-${degree - 1}`;
		return node.bin === null ? 'unrated' : `bin-${node.bin}`;
	}

	function select(index: number) {
		selected = selected === index ? null : index;
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
		hoverPos = {
			x: Math.min(x + 12, Math.max(0, box.width - 200)),
			y: above ? y - 12 : y + 12,
			above
		};
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
	<p class="empty">
		No two of your films share that many billed people. Lower the threshold, or widen the cast
		depth, to find the links.
	</p>
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
					class:selected={selected === index}
					role="button"
					tabindex="0"
					aria-label={describe(node)}
					onpointerenter={(e) => showHover(node, e)}
					onpointerleave={() => (hover = null)}
					onfocus={(e) => showHover(node, e)}
					onblur={() => (hover = null)}
					onclick={() => select(index)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							select(index);
						}
					}}
				>
					<circle class="hit" cx={node.x} cy={node.y} r={Math.max(node.r, HIT_RADIUS)} />
					<circle class="dot {fillClass(node, index)}" cx={node.x} cy={node.y} r={node.r} />
				</g>
			{/each}
		</svg>

		{#if hover}
			<div
				class="tooltip"
				class:below={!hoverPos.above}
				style="left: {hoverPos.x}px; top: {hoverPos.y}px"
			>
				<strong>{hover.film.name}</strong>
				<div>
					{#if hover.film.tmdb?.year}<span data-numeric>{hover.film.tmdb.year}</span> ·{/if}
					{#if hover.film.rating !== null}
						<span data-numeric>★ {hover.film.rating}</span> ·
					{/if}
					{hover.degree} connections
				</div>
			</div>
		{/if}
	</div>

	<div class="legend" aria-hidden="true">
		{#if selected !== null}
			<span class="less">Less <span data-numeric>({DEGREE_LABELS[0]})</span></span>
			<span class="scale">
				{#each DEGREE_LABELS as label, i (label)}
					<i class="swatch degree-{i}" title="{label} degree"></i>
				{/each}
			</span>
			<span class="more"
				>More <span data-numeric>({DEGREE_LABELS[DEGREE_LABELS.length - 1]})</span></span
			>
		{:else}
			<span class="less">Less <span data-numeric>(0.5)</span></span>
			<span class="scale">
				{#each HALF_STAR_LABELS as label, i (label)}
					<i class="swatch bin-{i}" title="★ {label}"></i>
				{/each}
			</span>
			<span class="more">More <span data-numeric>(5)</span></span>
			<span><i class="swatch unrated"></i>unrated</span>
		{/if}
	</div>

	<p class="note">
		{#if selected !== null}
			Dot colour: how many hops from the film you picked, up to the {DEGREE_LABELS.length}th degree;
			anything further fades out. Line strength: how many billed people two films share.
		{:else}
			Line strength: how many billed people two films share. Dot size: connections; dot colour: your
			rating. People in more than 40 of your films are skipped; they would link nearly everything to
			everything.
		{/if}
		{#if graph.omitted > 0}
			Showing the {graph.nodes.length} most connected of
			{graph.nodes.length + graph.omitted} linked films.
		{/if}
		{#if graph.isolated > 0}
			{graph.isolated} films share nobody with the rest and sit outside the graph.
		{/if}
	</p>

	{#if selected !== null}
		<div class="connections">
			<h3>
				Films connected to {graph.nodes[selected].film.name}: {connections.length}
			</h3>
			<ul>
				{#each connections as connection (connection.film.uri)}
					{@const href = webHref(connection.film.uri)}
					<li>
						{#if href}
							<a {href} target="_blank" rel="noopener" title={connection.film.name}
								>{connection.film.name}</a
							>
						{:else}
							<span class="name" title={connection.film.name}>{connection.film.name}</span>
						{/if}
						<span class="shared">via {connection.shared.join(', ')}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<details>
		<summary>View as table</summary>
		<table>
			<thead>
				<tr><th>Film</th><th class="num">Connections</th><th class="num">Your rating</th></tr>
			</thead>
			<tbody>
				{#each tableRows as node (node.film.uri)}
					<tr>
						<td>{node.film.name}</td>
						<td class="num" data-numeric>{node.degree}</td>
						<td class="num" data-numeric>{node.film.rating ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
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

	/* Rating ramp: one bin per half-star, the same 10-step --map-bin Viridis scale the world map
	   and heatmaps use. */
	.bin-0 {
		fill: var(--map-bin-0);
		background: var(--map-bin-0);
	}
	.bin-1 {
		fill: var(--map-bin-1);
		background: var(--map-bin-1);
	}
	.bin-2 {
		fill: var(--map-bin-2);
		background: var(--map-bin-2);
	}
	.bin-3 {
		fill: var(--map-bin-3);
		background: var(--map-bin-3);
	}
	.bin-4 {
		fill: var(--map-bin-4);
		background: var(--map-bin-4);
	}
	.bin-5 {
		fill: var(--map-bin-5);
		background: var(--map-bin-5);
	}
	.bin-6 {
		fill: var(--map-bin-6);
		background: var(--map-bin-6);
	}
	.bin-7 {
		fill: var(--map-bin-7);
		background: var(--map-bin-7);
	}
	.bin-8 {
		fill: var(--map-bin-8);
		background: var(--map-bin-8);
	}
	.bin-9 {
		fill: var(--map-bin-9);
		background: var(--map-bin-9);
	}
	.unrated {
		fill: var(--surface);
		background: var(--surface);
	}

	/* Degree ramp: a separate Plasma scale from the rating bins' Viridis, so a selected film's
	   ripple is never mistaken for a rating. */
	.degree-0 {
		fill: var(--degree-bin-0);
		background: var(--degree-bin-0);
	}
	.degree-1 {
		fill: var(--degree-bin-1);
		background: var(--degree-bin-1);
	}
	.degree-2 {
		fill: var(--degree-bin-2);
		background: var(--degree-bin-2);
	}
	.degree-3 {
		fill: var(--degree-bin-3);
		background: var(--degree-bin-3);
	}
	.degree-4 {
		fill: var(--degree-bin-4);
		background: var(--degree-bin-4);
	}
	.degree-5 {
		fill: var(--degree-bin-5);
		background: var(--degree-bin-5);
	}
	.degree-6 {
		fill: var(--degree-bin-6);
		background: var(--degree-bin-6);
	}
	.degree-7 {
		fill: var(--degree-bin-7);
		background: var(--degree-bin-7);
	}
	.degree-8 {
		fill: var(--degree-bin-8);
		background: var(--degree-bin-8);
	}
	.degree-9 {
		fill: var(--degree-bin-9);
		background: var(--degree-bin-9);
	}

	.tooltip {
		position: absolute;
		width: 190px;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		font-size: var(--text-sm);
		pointer-events: none;
		z-index: 1;
		/* Anchored at its bottom edge by default, growing upward from the point. Flipped to grow
		   downward near the top of the frame instead, so it clips against neither edge. */
		transform: translateY(-100%);
	}
	.tooltip.below {
		transform: translateY(0);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 8px;
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
	}
	.legend span {
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
		width: 14px;
		height: 14px;
		display: inline-block;
	}
	.swatch.unrated {
		border: 1px solid var(--border);
	}

	.empty,
	.note {
		font-size: var(--text-2xs);
		color: var(--fg-muted);
		margin: 8px 0 0;
	}
	.empty {
		font-size: var(--text-sm);
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
	.connections a,
	.connections .name {
		color: var(--fg);
		text-decoration: none;
	}
	.connections a {
		color: var(--accent);
	}
	.connections a:hover {
		text-decoration: underline;
	}
	.connections .shared {
		color: var(--fg-muted);
		font-size: var(--text-2xs);
	}

	details {
		margin-top: 12px;
	}
	summary {
		cursor: pointer;
		color: var(--fg-secondary);
		font-size: var(--text-sm);
	}
	table {
		border-collapse: collapse;
		margin-top: 8px;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: 4px 12px;
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	thead tr {
		background: var(--bg-secondary);
	}
	.num {
		text-align: right;
	}
</style>
