<script lang="ts">
	import MetricToggle from './MetricToggle.svelte';
	import { webHref } from './href';
	import { RATING_BIN_LABELS } from './ramp';
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

	/** Every node one edge away from `index`, plus the node itself. */
	const focus = $derived.by(() => {
		if (selected === null) return null;
		const near = new Set<number>([selected]);
		for (const edge of graph.edges) {
			if (edge.source === selected) near.add(edge.target);
			if (edge.target === selected) near.add(edge.source);
		}
		return near;
	});

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

	function fillClass(node: NetworkNode): string {
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
						class:dim={focus !== null && !(focus.has(edge.source) && focus.has(edge.target))}
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
					class:dim={focus !== null && !focus.has(index)}
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
					<circle class="dot {fillClass(node)}" cx={node.x} cy={node.y} r={node.r} />
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
					<span data-numeric>{hover.degree}</span> connections
				</div>
			</div>
		{/if}
	</div>

	<div class="legend" aria-hidden="true">
		{#each RATING_BIN_LABELS as label, i (label)}
			<span data-numeric><i class="swatch bin-{i}"></i>{label}</span>
		{/each}
		<span><i class="swatch unrated"></i>unrated</span>
	</div>

	<p class="note">
		Line strength: how many billed people two films share. Dot size: connections; dot colour: your
		rating. People in more than 40 of your films are skipped; they would link nearly everything to
		everything.
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
		opacity: 0.15;
	}

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
	.unrated {
		fill: var(--surface);
		background: var(--surface);
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
