<script lang="ts">
	import type { BarDatum } from './stats';

	let { data, description }: { data: BarDatum[]; description: string } = $props();

	const max = $derived(Math.max(1, ...data.map((d) => d.count)));
	const showEvery = $derived(Math.ceil(data.length / 16));
</script>

<div class="chart" role="img" aria-label={description}>
	{#each data as d, i (d.label)}
		<div class="col" title="{d.label}: {d.count}">
			<span class="val">{d.count > 0 ? d.count : ''}</span>
			<div class="bar" style="height: {Math.max(d.count === 0 ? 0 : 3, (d.count / max) * 140)}px"></div>
			<span class="lab">{i % showEvery === 0 ? d.label : ''}</span>
		</div>
	{/each}
</div>

<style>
	.chart {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0;
	}
	.col {
		flex: 1 1 0;
		max-width: 32px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
	}
	.bar {
		width: 100%;
		max-width: 24px;
		background: var(--accent);
		border-radius: 4px 4px 0 0;
	}
	.col:hover .bar {
		filter: brightness(1.15);
	}
	.val {
		font-size: 0.75rem;
		color: var(--fg-muted);
		font-variant-numeric: tabular-nums;
	}
	.lab {
		font-size: 0.75rem;
		color: var(--fg-secondary);
		padding-top: 4px;
		white-space: nowrap;
	}
</style>
