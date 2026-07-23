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
		RATING_BIN_LABELS,
		RATING_THRESHOLDS
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

	const maxCount = $derived(Math.max(1, ...[...stats.values()].map((s) => s.count)));
	const thresholds = $derived(metric === 'count' ? countThresholds(maxCount) : RATING_THRESHOLDS);
	const binLabels = $derived(metric === 'count' ? countBinLabels(thresholds) : RATING_BIN_LABELS);

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
			const scale = mapBox.width / WIDTH;
			x = shape.centroid[0] * scale;
			y = shape.centroid[1] * scale;
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
		<svg viewBox="0 0 {WIDTH} {HEIGHT}" role="group" aria-label="World map of your films">
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
						onclick={() => (selected = selected?.code === stat.code ? null : stat)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								selected = selected?.code === stat.code ? null : stat;
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
					<span class="value">{hoverStat.count}</span>
					film{hoverStat.count === 1 ? '' : 's'}
					{#if hoverStat.avg !== null}
						· <span class="value">{hoverStat.avg.toFixed(2)}</span> avg
						{#if metric === 'rating' && hoverStat.ratedCount < hoverStat.count}
							({hoverStat.ratedCount} rated)
						{/if}
					{/if}
				</div>
				<ul>
					{#each hoverFilms as film (film.uri)}
						<li>{film.name}{film.rating !== null ? ` — ${film.rating}` : ''}</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="legend" aria-hidden="true">
		{#each binLabels as label, i (i)}
			<span><i class="swatch bin-{i}"></i>{label}</span>
		{/each}
		{#if metric === 'rating'}
			<span><i class="swatch few"></i>no ratings</span>
		{/if}
		<span><i class="swatch nodata"></i>no films</span>
	</div>
	<p class="note">A film with several production countries counts for each of them.</p>

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
	}
	svg path {
		stroke: var(--bg);
		stroke-width: 0.5;
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

	.tooltip {
		position: absolute;
		width: 180px;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		font-size: 0.875rem;
		pointer-events: none;
		z-index: 1;
	}
	.tooltip ul {
		margin: 4px 0 0;
		padding-left: 16px;
		color: var(--fg-secondary);
	}
	.value {
		font-weight: 600;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 8px;
		font-size: 0.75rem;
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
	.swatch.nodata,
	.swatch.few {
		border: 1px solid var(--border);
	}

	.note {
		font-size: 0.75rem;
		color: var(--fg-muted);
		margin: 4px 0 0;
	}

	details {
		margin-top: 12px;
	}
	summary {
		cursor: pointer;
		color: var(--fg-secondary);
		font-size: 0.875rem;
	}
	table {
		border-collapse: collapse;
		margin-top: 8px;
		font-size: 0.875rem;
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
		font-variant-numeric: tabular-nums;
	}
</style>
