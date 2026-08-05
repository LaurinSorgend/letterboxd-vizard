<script lang="ts">
	import { metacriticGaps, type MetacriticGap } from './stats';
	import { webHref } from './href';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const gaps = $derived(metacriticGaps(films));
	const lists = $derived([
		{ title: "You loved it, critics didn't", rows: gaps.over },
		{ title: "Critics loved it, you didn't", rows: gaps.under }
	]);
	const max = $derived(
		Math.max(1, ...gaps.over.map((g) => g.gap), ...gaps.under.map((g) => -g.gap))
	);

	function barWidth(gap: MetacriticGap): number {
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
						<a href={webHref(row.film.uri) ?? undefined} target="_blank" rel="noopener">
							{row.film.name}
						</a>
					</span>
					<span class="track" title="you {row.yours.toFixed(0)} · Metacritic {row.metascore}">
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
	.lab a {
		color: var(--fg-secondary);
		text-decoration: none;
	}
	.lab a:hover {
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
