<script lang="ts">
	import type { BarDatum } from './stats';

	let {
		data,
		limit = 12,
		showAvg = false,
		description
	}: { data: BarDatum[]; limit?: number; showAvg?: boolean; description: string } = $props();

	const rows = $derived(data.slice(0, limit));
	const max = $derived(Math.max(1, ...rows.map((d) => d.count)));
</script>

<div class="chart" role="img" aria-label={description}>
	{#each rows as d (d.label)}
		<span class="lab" title={d.label}>{d.label}</span>
		<div class="track" title="{d.label}: {d.count}{d.avg !== null ? `, avg ${d.avg.toFixed(1)}` : ''}">
			<div class="bar" style="width: {(d.count / max) * 100}%"></div>
			<span class="val">{d.count}</span>
		</div>
		{#if showAvg}
			<span class="avg">{d.avg !== null ? `★ ${d.avg.toFixed(1)}` : '—'}</span>
		{/if}
	{/each}
</div>

<style>
	.chart {
		display: grid;
		grid-template-columns: minmax(72px, max-content) 1fr auto;
		gap: 4px 12px;
		align-items: center;
	}
	.lab {
		font-size: 0.875rem;
		color: var(--fg-secondary);
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.track {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.bar {
		height: 14px;
		min-width: 2px;
		background: var(--accent);
		border-radius: 0 4px 4px 0;
	}
	.track:hover .bar {
		filter: brightness(1.15);
	}
	.val {
		font-size: 0.75rem;
		color: var(--fg-muted);
		font-variant-numeric: tabular-nums;
	}
	.avg {
		font-size: 0.75rem;
		color: var(--fg-secondary);
		font-variant-numeric: tabular-nums;
		justify-self: end;
	}
</style>
