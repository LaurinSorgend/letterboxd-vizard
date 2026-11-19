<script lang="ts">
	import { extremes, gapsTo, METACRITIC, type RatingGap } from '$lib/film/ratings';
	import FilmLink from './chart/FilmLink.svelte';
	import type { EnrichedFilm } from '$lib/types';

	const TOP_N = 10;

	let { films }: { films: EnrichedFilm[] } = $props();

	const gaps = $derived(extremes(gapsTo(films, METACRITIC), TOP_N));
	const lists = $derived([
		{ title: "You loved it, critics didn't", rows: gaps.over },
		{ title: "Critics loved it, you didn't", rows: gaps.under }
	]);
	const max = $derived(
		Math.max(1, ...gaps.over.map((g) => g.gap), ...gaps.under.map((g) => -g.gap))
	);

	function barWidth(gap: RatingGap): number {
		return (Math.abs(gap.gap) / max) * 100;
	}
</script>

<div class="cols">
	{#each lists as list (list.title)}
		<div>
			<h3>{list.title}</h3>
			<div class="chart">
				{#each list.rows as row (row.film.uri)}
					<span class="lab" title={row.film.name}>
						<FilmLink film={row.film} title={null} />
					</span>
					<span class="track" title="you {row.yours.toFixed(0)} · Metacritic {row.source}">
						<span class="bar" style="width: {barWidth(row)}%"></span>
						<span class="val" data-numeric>{Math.abs(row.gap).toFixed(0)}</span>
					</span>
				{:else}
					<p class="empty">No films diverge this way yet.</p>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 24px;
	}
	h3 {
		margin: 0 0 8px;
	}
	.chart {
		display: grid;
		grid-template-columns: minmax(72px, max-content) 1fr;
		gap: 4px 12px;
		align-items: center;
	}
	.lab {
		font-size: var(--text-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}
	.lab :global(a) {
		color: var(--fg-secondary);
		text-decoration: none;
	}
	.lab :global(a:hover) {
		text-decoration: underline;
		color: var(--accent);
	}
	.track {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.bar {
		height: 18px;
		min-width: 2px;
		background: var(--accent);
	}
	.val {
		font-size: var(--text-sm);
		color: var(--fg-muted);
	}
	.empty {
		color: var(--fg-muted);
		font-size: var(--text-sm);
	}
</style>
