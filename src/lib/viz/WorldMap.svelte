<script lang="ts">
	import { onMount } from 'svelte';
	import { geoNaturalEarth1, geoPath } from 'd3-geo';
	import { feature } from 'topojson-client';
	import type { Topology, GeometryCollection } from 'topojson-specification';
	import CountryRec from './CountryRec.svelte';
	import FilmList from './FilmList.svelte';
	import MetricToggle from './MetricToggle.svelte';
	import { aggregateCountries, numericToAlpha2, type CountryStat } from './countries';
	import { watchedTmdbIds } from './seeds';
	import {
		countThresholds,
		countBinLabels,
		binIndex,
		HALF_STAR_RANGE_LABELS,
		HALF_STAR_THRESHOLDS
	} from './ramp';
	import type { EnrichedFilm } from '$lib/types';

	const WIDTH = 960;
	const HEIGHT = 480;

	let {
		films,
		initialMetric = 'count',
		presetCountry = null,
		watchlistExclude = []
	}: {
		films: EnrichedFilm[];
		initialMetric?: 'count' | 'rating';
		presetCountry?: string | null;
		watchlistExclude?: number[];
	} = $props();

	type Shape = { code: string | undefined; d: string; centroid: [number, number] };
	let shapes: Shape[] = $state([]);
	// svelte-ignore state_referenced_locally -- URL presets are initial values by design
	let metric: 'count' | 'rating' = $state(initialMetric);
	let container: HTMLElement | undefined = $state();

	const stats = $derived(aggregateCountries(films));
	const excludeIds = $derived([...watchedTmdbIds(films), ...watchlistExclude]);

	// svelte-ignore state_referenced_locally -- URL presets are initial values by design
	let selected: CountryStat | null = $state(
		presetCountry ? (stats.get(presetCountry) ?? null) : null
	);
	let hoverStat: CountryStat | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0 });
	let mapBox: DOMRect | null = null;

	const MIN_ZOOM = 1;
	const MAX_ZOOM = 12;
	/** Past this much movement the gesture is a drag, so releasing must not also select a country. */
	const DRAG_SLOP_PX = 4;

	let svgEl: SVGSVGElement | undefined = $state();
	let view = $state({ x: 0, y: 0, k: MIN_ZOOM });
	const viewBox = $derived(`${view.x} ${view.y} ${WIDTH / view.k} ${HEIGHT / view.k}`);

	const pointers = new Map<number, { x: number; y: number }>();
	let gestureStart: { x: number; y: number } | null = null;
	let pinchSpread = 0;
	let panned = false;

	/** Keeps the visible window inside the map and the zoom within its limits. */
	function clampView(next: { x: number; y: number; k: number }) {
		const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next.k));
		return {
			k,
			x: Math.min(Math.max(next.x, 0), WIDTH - WIDTH / k),
			y: Math.min(Math.max(next.y, 0), HEIGHT - HEIGHT / k)
		};
	}

	/** A client point in the map's own coordinates. */
	function toMap(clientX: number, clientY: number): { x: number; y: number } {
		const box = svgEl?.getBoundingClientRect();
		if (!box) return { x: 0, y: 0 };
		return {
			x: view.x + ((clientX - box.left) / box.width) * (WIDTH / view.k),
			y: view.y + ((clientY - box.top) / box.height) * (HEIGHT / view.k)
		};
	}

	/** Zooms to `k`, holding whatever lies under `client` still; centres the change without one. */
	function zoomTo(k: number, client?: { x: number; y: number }) {
		const anchor = client
			? toMap(client.x, client.y)
			: { x: view.x + WIDTH / view.k / 2, y: view.y + HEIGHT / view.k / 2 };
		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
		view = clampView({
			k: next,
			x: anchor.x - (anchor.x - view.x) * (view.k / next),
			y: anchor.y - (anchor.y - view.y) * (view.k / next)
		});
	}

	function spread(): number {
		const [a, b] = [...pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function midpoint(): { x: number; y: number } {
		const [a, b] = [...pointers.values()];
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	function startGesture(event: PointerEvent) {
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 1) {
			gestureStart = { x: event.clientX, y: event.clientY };
			panned = false;
		}
		if (pointers.size === 2) pinchSpread = spread();
	}

	function moveGesture(event: PointerEvent) {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		const travel = gestureStart
			? Math.hypot(event.clientX - gestureStart.x, event.clientY - gestureStart.y)
			: 0;
		if (travel > DRAG_SLOP_PX) panned = true;

		if (pointers.size >= 2) {
			const next = spread();
			if (pinchSpread > 0) zoomTo((view.k * next) / pinchSpread, midpoint());
			pinchSpread = next;
			panned = true;
			return;
		}
		if (!panned || view.k === MIN_ZOOM) return;
		const box = svgEl?.getBoundingClientRect();
		if (!box) return;
		hoverStat = null;
		view = clampView({
			k: view.k,
			x: view.x - ((event.clientX - previous.x) / box.width) * (WIDTH / view.k),
			y: view.y - ((event.clientY - previous.y) / box.height) * (HEIGHT / view.k)
		});
	}

	function endGesture(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (pointers.size < 2) pinchSpread = 0;
		if (pointers.size === 0) gestureStart = null;
	}

	/** Ctrl or ⌘ only, so a plain scroll still moves the page. Trackpad pinch sends ctrl for us. */
	function onWheel(event: WheelEvent) {
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();
		zoomTo(view.k * (event.deltaY < 0 ? 1.25 : 0.8), { x: event.clientX, y: event.clientY });
	}

	function select(stat: CountryStat) {
		selected = selected?.code === stat.code ? null : stat;
	}

	const maxCount = $derived(Math.max(1, ...[...stats.values()].map((s) => s.count)));
	const thresholds = $derived(
		metric === 'count' ? countThresholds(maxCount) : HALF_STAR_THRESHOLDS
	);
	const binLabels = $derived(
		metric === 'count' ? countBinLabels(thresholds) : HALF_STAR_RANGE_LABELS
	);
	/** The scale's real endpoints, shown next to Less/More. */
	const legendRange = $derived(
		metric === 'count' ? { min: '1', max: String(maxCount) } : { min: '0.5', max: '5' }
	);

	onMount(async () => {
		const topo = (await import('world-atlas/countries-50m.json')).default as unknown as Topology<{
			countries: GeometryCollection<{ name: string }>;
		}>;
		const world = feature(topo, topo.objects.countries);
		world.features = world.features.filter((f) => f.id !== '010'); // Antarctica
		const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], world);
		const path = geoPath(projection);
		shapes = world.features.map((f) => ({
			code: numericToAlpha2[String(f.id)],
			d: path(f) ?? '',
			centroid: path.centroid(f)
		}));
	});

	function binOf(stat: CountryStat): number | 'few' | null {
		if (metric === 'count') return binIndex(stat.count, thresholds);
		if (stat.ratedCount === 0) return 'few';
		return binIndex(stat.avg ?? 0, thresholds);
	}

	function fillClass(code: string | undefined): string {
		const stat = code ? stats.get(code) : undefined;
		if (!stat) return 'nodata';
		const bin = binOf(stat);
		return bin === 'few' ? 'few' : `bin-${bin}`;
	}

	function describe(stat: CountryStat): string {
		const avg = stat.avg !== null ? `, average rating ${stat.avg.toFixed(2)}` : '';
		return `${stat.name}: ${stat.count} film${stat.count === 1 ? '' : 's'}${avg}`;
	}

	function showHover(code: string | undefined, event: PointerEvent | FocusEvent) {
		const stat = code ? stats.get(code) : undefined;
		if (!stat || !container) {
			hoverStat = null;
			return;
		}
		// Layout is read once on enter/focus, not per pointermove.
		if (!mapBox || event.type !== 'pointermove') mapBox = container.getBoundingClientRect();
		let x: number;
		let y: number;
		if (event instanceof PointerEvent) {
			x = event.clientX - mapBox.left;
			y = event.clientY - mapBox.top;
		} else {
			const shape = shapes.find((s) => s.code === code);
			if (!shape) return;
			const scale = mapBox.width / (WIDTH / view.k);
			x = (shape.centroid[0] - view.x) * scale;
			y = (shape.centroid[1] - view.y) * scale;
		}
		hoverPos = { x: Math.min(x + 12, mapBox.width - 180), y: y + 12 };
		hoverStat = stat;
	}

	function topFilms(stat: CountryStat, n: number): EnrichedFilm[] {
		return [...stat.films].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)).slice(0, n);
	}

	const hoverFilms = $derived(hoverStat ? topFilms(hoverStat, 3) : []);

	const tableRows = $derived(
		[...stats.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
	);
</script>

<section aria-label="Films by country">
	<MetricToggle
		name="map-metric"
		label="Map metric"
		options={[
			{ value: 'count', label: 'Films watched' },
			{ value: 'rating', label: 'Average rating' }
		]}
		bind:value={metric}
	/>

	<div class="map" bind:this={container}>
		<svg
			bind:this={svgEl}
			{viewBox}
			class:zoomed={view.k > MIN_ZOOM}
			role="group"
			aria-label="World map of your films"
			onpointerdown={startGesture}
			onpointermove={moveGesture}
			onpointerup={endGesture}
			onpointercancel={endGesture}
			onpointerleave={endGesture}
			onwheel={onWheel}
		>
			{#each shapes as shape (shape.d)}
				{@const stat = shape.code ? stats.get(shape.code) : undefined}
				{#if stat}
					<path
						class={fillClass(shape.code)}
						class:selected={selected?.code === shape.code}
						d={shape.d}
						role="button"
						tabindex="0"
						aria-label={describe(stat)}
						onpointerenter={(e) => showHover(shape.code, e)}
						onpointermove={(e) => showHover(shape.code, e)}
						onpointerleave={() => (hoverStat = null)}
						onfocus={(e) => showHover(shape.code, e)}
						onblur={() => (hoverStat = null)}
						onclick={() => {
							if (!panned) select(stat);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								select(stat);
							}
						}}
					/>
				{:else}
					<path class="nodata" d={shape.d} />
				{/if}
			{/each}
		</svg>

		{#if hoverStat}
			<div class="tooltip" style="left: {hoverPos.x}px; top: {hoverPos.y}px">
				<strong>{hoverStat.name}</strong>
				<div>
					<span class="value" data-numeric>{hoverStat.count}</span>
					film{hoverStat.count === 1 ? '' : 's'}
					{#if hoverStat.avg !== null}
						· <span class="value" data-numeric>{hoverStat.avg.toFixed(2)}</span> avg
						{#if metric === 'rating' && hoverStat.ratedCount < hoverStat.count}
							(<span data-numeric>{hoverStat.ratedCount}</span> rated)
						{/if}
					{/if}
				</div>
				<ul>
					{#each hoverFilms as film (film.uri)}
						<li>
							{film.name}{film.rating !== null ? ': ' : ''}{#if film.rating !== null}<span
									data-numeric>{film.rating}</span
								>{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="zoom">
			<button type="button" aria-label="Zoom in" onclick={() => zoomTo(view.k * 1.6)}>+</button>
			<button type="button" aria-label="Zoom out" onclick={() => zoomTo(view.k / 1.6)}>−</button>
			<button
				type="button"
				aria-label="Reset zoom"
				disabled={view.k === MIN_ZOOM}
				onclick={() => (view = { x: 0, y: 0, k: MIN_ZOOM })}
			>
				Reset
			</button>
		</div>
	</div>

	<div class="legend" aria-hidden="true">
		<span class="less">Less <span data-numeric>({legendRange.min})</span></span>
		<span class="scale">
			{#each binLabels as label, i (i)}
				<i class="swatch bin-{i}" title={label}></i>
			{/each}
		</span>
		<span class="more">More <span data-numeric>({legendRange.max})</span></span>
		{#if metric === 'rating'}
			<span><i class="swatch few"></i>no ratings</span>
		{/if}
		<span><i class="swatch nodata"></i>no films</span>
	</div>
	<p class="note">
		Films with several production countries count once for each. Zoom by pinch or buttons, drag to
		pan; on a mouse, hold Ctrl and scroll.
	</p>

	{#if selected}
		{#key selected.code}
			<CountryRec stat={selected} exclude={excludeIds} />
		{/key}
		<FilmList title={selected.name} films={selected.films} />
	{/if}

	<details>
		<summary>View as table</summary>
		<table>
			<thead>
				<tr><th>Country</th><th class="num">Films</th><th class="num">Avg rating</th></tr>
			</thead>
			<tbody>
				{#each tableRows as stat (stat.code)}
					<tr>
						<td>{stat.name}</td>
						<td class="num">{stat.count}</td>
						<td class="num">{stat.avg !== null ? stat.avg.toFixed(2) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
</section>

<style>
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

	.nodata {
		fill: var(--bg-secondary);
		background: var(--bg-secondary);
	}
	.few {
		fill: var(--surface);
		background: var(--surface);
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		user-select: none;
		/*
		 * At the default fit a vertical swipe should still scroll the page past the map; once
		 * zoomed the surface belongs to the map, so a drag in any direction pans it instead.
		 * Neither value hands pinch to the browser, so two fingers always zoom the map itself.
		 */
		touch-action: pan-y;
	}
	svg.zoomed {
		touch-action: none;
		cursor: grab;
	}
	/* Widths stay in screen pixels, so borders do not fatten as the viewBox zooms in. */
	svg path {
		stroke: var(--bg);
		stroke-width: 0.5;
		vector-effect: non-scaling-stroke;
	}
	svg path[role='button'] {
		cursor: pointer;
	}
	svg path[role='button']:hover {
		stroke: var(--fg);
		stroke-width: 1;
	}
	svg path:focus-visible {
		outline: none;
		stroke: var(--focus);
		stroke-width: 2;
	}
	svg path.selected {
		stroke: var(--fg);
		stroke-width: 1.5;
	}

	.map {
		position: relative;
	}

	.zoom {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.zoom button {
		font: inherit;
		font-size: var(--text-sm);
		line-height: 1;
		min-width: 32px;
		padding: 6px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		cursor: pointer;
	}
	.zoom button:hover:not(:disabled) {
		background: var(--surface);
	}
	.zoom button:disabled {
		color: var(--fg-muted);
		cursor: default;
	}

	.tooltip {
		position: absolute;
		width: 180px;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		font-size: var(--text-sm);
		pointer-events: none;
		z-index: 1;
	}
	.tooltip ul {
		margin: 4px 0 0;
		padding-left: 16px;
		color: var(--fg-secondary);
	}
	.value {
		font-weight: 700;
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
	.swatch.nodata,
	.swatch.few {
		border: 1px solid var(--border);
	}

	.note {
		font-size: var(--text-2xs);
		color: var(--fg-muted);
		margin: 4px 0 0;
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
