<script lang="ts">
	import FilmList from './FilmList.svelte';
	import type { BarDatum } from './stats';

	let { data, description }: { data: BarDatum[]; description: string } = $props();

	let selectedLabel: string | null = $state(null);
	const max = $derived(Math.max(1, ...data.map((d) => d.count)));
	const showEvery = $derived(Math.ceil(data.length / 16));
	const selected = $derived(
		selectedLabel === null ? null : (data.find((d) => d.label === selectedLabel) ?? null)
	);

	function toggle(label: string) {
		selectedLabel = selectedLabel === label ? null : label;
	}
</script>

<div class="chart" role="group" aria-label={description}>
	{#each data as d, i (d.label)}
		{#if d.count > 0}
			<button
				type="button"
				class="col"
				aria-pressed={selectedLabel === d.label}
				title="{d.label}: {d.count} — click to list films"
				onclick={() => toggle(d.label)}
			>
				<span class="val">{d.count}</span>
				<span class="bar" style="height: {Math.max(3, (d.count / max) * 140)}px"></span>
				<span class="lab">{i % showEvery === 0 ? d.label : ''}</span>
			</button>
		{:else}
			<div class="col" title="{d.label}: 0">
				<span class="val"></span>
				<span class="bar" style="height: 0"></span>
				<span class="lab">{i % showEvery === 0 ? d.label : ''}</span>
			</div>
		{/if}
	{/each}
</div>
{#if selected}
	<FilmList title={selected.label} films={selected.films} />
{/if}

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
	button.col {
		font: inherit;
		padding: 0;
		margin: 0;
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.bar {
		width: 100%;
		max-width: 24px;
		background: var(--accent);
	}
	.col:hover .bar {
		filter: brightness(1.15);
	}
	button.col[aria-pressed='true'] .bar {
		box-shadow: 0 0 0 1.5px var(--fg);
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
