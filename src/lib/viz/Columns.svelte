<script lang="ts">
	import FilmList from './FilmList.svelte';
	import { selectByLabel } from './selection.svelte';
	import type { BarDatum } from './stats';

	let { data, description }: { data: BarDatum[]; description: string } = $props();

	const selection = selectByLabel(() => data);
	const max = $derived(Math.max(1, ...data.map((d) => d.count)));
	const showEvery = $derived(Math.ceil(data.length / 16));
</script>

<div class="chart" role="group" aria-label={description}>
	{#each data as d, i (d.label)}
		{#if d.count > 0}
			<button
				type="button"
				class="col"
				aria-pressed={selection.isSelected(d.label)}
				title="{d.label}: {d.count} — click to list films"
				onclick={() => selection.toggle(d.label)}
			>
				<span class="val" data-numeric>{d.count}</span>
				<span class="bar" style="height: {Math.max(3, (d.count / max) * 140)}px"></span>
				<span class="lab" data-numeric>{i % showEvery === 0 ? d.label : ''}</span>
			</button>
		{:else}
			<div class="col" title="{d.label}: 0">
				<span class="val"></span>
				<span class="bar" style="height: 0"></span>
				<span class="lab" data-numeric>{i % showEvery === 0 ? d.label : ''}</span>
			</div>
		{/if}
	{/each}
</div>
{#if selection.selected}
	{@const selected = selection.selected}
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
		/* Wide enough for a mono axis label like "1930s"; .bar caps its own width,
		 * so this spaces the columns out rather than fattening the bars. */
		max-width: 48px;
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
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.lab {
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
		padding-top: 4px;
		white-space: nowrap;
	}
</style>
