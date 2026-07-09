<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { geoNaturalEarth1, geoPath } from 'd3-geo';
	import { feature } from 'topojson-client';
	import type { Topology, GeometryCollection } from 'topojson-specification';
	import CountryRec from './CountryRec.svelte';
	import { aggregateCountries, numericToAlpha2, type CountryStat } from './countries';
	import {
		countThresholds,
		countBinLabels,
		ratingBinLabels,
		binIndex,
		RATING_THRESHOLDS
	} from './ramp';
	import type { EnrichedFilm } from '$lib/types';

	const MIN_RATED = 3;
	const WIDTH = 960;
	const HEIGHT = 480;

	let { films }: { films: EnrichedFilm[] } = $props();

	type Shape = { code: string | undefined; d: string; centroid: [number, number] };
	let shapes: Shape[] = $state([]);
	let metric: 'count' | 'rating' = $state(
		page.url.searchParams.get('metric') === 'rating' ? 'rating' : 'count'
	);
	let selected: CountryStat | null = $state(null);
	let hover: { stat: CountryStat; x: number; y: number } | null = $state(null);
	let container: HTMLElement | undefined = $state();

	const stats = $derived(aggregateCountries(films));
	const watchedIds = $derived(
		films.filter((f) => f.tmdb && f.tmdb.tmdbId > 0).map((f) => f.tmdb!.tmdbId)
	);

	let presetApplied = false;
	$effect(() => {
		const want = page.url.searchParams.get('country');
		if (presetApplied || !want) return;
		presetApplied = true;
		selected = stats.get(want) ?? null;
	});
	const maxCount = $derived(Math.max(1, ...[...stats.values()].map((s) => s.count)));
	const thresholds = $derived(metric === 'count' ? countThresholds(maxCount) : RATING_THRESHOLDS);
	const binLabels = $derived(metric === 'count' ? countBinLabels(thresholds) : ratingBinLabels());

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
		if (stat.ratedCount < MIN_RATED) return 'few';
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
			hover = null;
			return;
		}
		const box = container.getBoundingClientRect();
		if (event instanceof PointerEvent) {
			hover = { stat, x: event.clientX - box.left, y: event.clientY - box.top };
		} else {
			const shape = shapes.find((s) => s.code === code);
			if (!shape) return;
			const scale = box.width / WIDTH;
			hover = { stat, x: shape.centroid[0] * scale, y: shape.centroid[1] * scale };
		}
	}

	function topFilms(stat: CountryStat, n: number): EnrichedFilm[] {
		return [...stat.films].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)).slice(0, n);
	}

	const tableRows = $derived(
		[...stats.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
	);
</script>

<section aria-label="Films by country">
	<div class="controls">
		<fieldset>
			<legend class="visually-hidden">Map metric</legend>
			<label class:active={metric === 'count'}>
				<input type="radio" name="metric" value="count" bind:group={metric} />
				Films watched
			</label>
			<label class:active={metric === 'rating'}>
				<input type="radio" name="metric" value="rating" bind:group={metric} />
				Average rating
			</label>
		</fieldset>
	</div>

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
						onpointerleave={() => (hover = null)}
						onfocus={(e) => showHover(shape.code, e)}
						onblur={() => (hover = null)}
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

		{#if hover}
			<div
				class="tooltip"
				style="left: {Math.min(hover.x + 12, (container?.clientWidth ?? 0) - 180)}px; top: {hover.y +
					12}px"
			>
				<strong>{hover.stat.name}</strong>
				<div>
					<span class="value">{hover.stat.count}</span>
					film{hover.stat.count === 1 ? '' : 's'}
					{#if hover.stat.avg !== null}
						· <span class="value">{hover.stat.avg.toFixed(2)}</span> avg
						{#if metric === 'rating' && hover.stat.ratedCount < MIN_RATED}
							(only {hover.stat.ratedCount} rated)
						{/if}
					{/if}
				</div>
				<ul>
					{#each topFilms(hover.stat, 3) as film (film.uri)}
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
			<span><i class="swatch few"></i>&lt; {MIN_RATED} rated</span>
		{/if}
		<span><i class="swatch nodata"></i>no films</span>
	</div>
	<p class="note">A film with several production countries counts for each of them.</p>

	{#if selected}
		<div class="panel">
			<h3>{selected.name} — {selected.count} film{selected.count === 1 ? '' : 's'}</h3>
			{#key selected.code}
				<CountryRec stat={selected} exclude={watchedIds} />
			{/key}
			<ul>
				{#each topFilms(selected, selected.films.length) as film (film.uri)}
					<li>
						<a href={film.uri} target="_blank" rel="noopener" title={film.name}>{film.name}</a>
						<span class="meta">{film.year ?? ''}</span>
						{#if film.rating !== null}<span class="value">{film.rating}</span>{/if}
					</li>
				{/each}
			</ul>
		</div>
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
	/* Viridis ramps per theme, validated for both surfaces (see ramp.ts). */
	.bin-0 { fill: #2fb47c; background: #2fb47c; }
	.bin-1 { fill: #21918c; background: #21918c; }
	.bin-2 { fill: #2f6c8e; background: #2f6c8e; }
	.bin-3 { fill: #414487; background: #414487; }
	.bin-4 { fill: #471365; background: #471365; }

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .bin-0 { fill: #355f8d; background: #355f8d; }
		:global(:root:not([data-theme='light'])) .bin-1 { fill: #24868e; background: #24868e; }
		:global(:root:not([data-theme='light'])) .bin-2 { fill: #26ad81; background: #26ad81; }
		:global(:root:not([data-theme='light'])) .bin-3 { fill: #6ece58; background: #6ece58; }
		:global(:root:not([data-theme='light'])) .bin-4 { fill: #dfe318; background: #dfe318; }
	}
	:global(:root[data-theme='dark']) .bin-0 { fill: #355f8d; background: #355f8d; }
	:global(:root[data-theme='dark']) .bin-1 { fill: #24868e; background: #24868e; }
	:global(:root[data-theme='dark']) .bin-2 { fill: #26ad81; background: #26ad81; }
	:global(:root[data-theme='dark']) .bin-3 { fill: #6ece58; background: #6ece58; }
	:global(:root[data-theme='dark']) .bin-4 { fill: #dfe318; background: #dfe318; }

	.nodata { fill: var(--bg-secondary); background: var(--bg-secondary); }
	.few { fill: var(--surface); background: var(--surface); }

	svg { display: block; width: 100%; height: auto; }
	svg path { stroke: var(--bg); stroke-width: 0.5; }
	svg path[role='button'] { cursor: pointer; }
	svg path[role='button']:hover { stroke: var(--fg); stroke-width: 1; }
	svg path:focus-visible { outline: none; stroke: var(--focus); stroke-width: 2; }
	svg path.selected { stroke: var(--fg); stroke-width: 1.5; }

	.map { position: relative; }

	.tooltip {
		position: absolute;
		width: 180px;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		border-radius: 4px;
		font-size: 0.875rem;
		pointer-events: none;
		z-index: 1;
	}
	.tooltip ul { margin: 4px 0 0; padding-left: 16px; color: var(--fg-secondary); }
	.value { font-weight: 600; }

	.controls fieldset { border: none; margin: 0 0 8px; padding: 0; display: flex; gap: 8px; }
	.controls label {
		padding: 4px 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}
	.controls label.active { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
	.controls input { position: absolute; opacity: 0; }
	.controls label:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }

	.legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 0.75rem; color: var(--fg-secondary); }
	.legend span { display: inline-flex; align-items: center; gap: 4px; }
	.swatch { width: 14px; height: 14px; border-radius: 2px; display: inline-block; }
	.swatch.nodata, .swatch.few { border: 1px solid var(--border); }

	.note { font-size: 0.75rem; color: var(--fg-muted); margin: 4px 0 0; }

	.panel { margin-top: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 4px; }
	.panel h3 { margin: 0 0 8px; }
	.panel ul { margin: 0; padding: 0; list-style: none; columns: 2; column-gap: 24px; }
	.panel li { display: flex; gap: 8px; padding: 2px 0; break-inside: avoid; }
	.panel .meta { color: var(--fg-muted); }
	.panel a { color: var(--accent); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.panel a:hover { text-decoration: underline; }
	.panel .value { margin-left: auto; font-variant-numeric: tabular-nums; }

	details { margin-top: 12px; }
	summary { cursor: pointer; color: var(--fg-secondary); font-size: 0.875rem; }
	table { border-collapse: collapse; margin-top: 8px; font-size: 0.875rem; }
	th, td { padding: 4px 12px; border-bottom: 1px solid var(--border); text-align: left; }
	thead tr { background: var(--bg-secondary); }
	.num { text-align: right; font-variant-numeric: tabular-nums; }

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	@media (max-width: 640px) {
		.panel ul { columns: 1; }
	}
</style>
