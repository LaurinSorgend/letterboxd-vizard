<script lang="ts">
	import FilmList from './FilmList.svelte';
	import { selectByKey } from './selection.svelte';
	import type { BarDatum } from '$lib/film/tally';

	let {
		data,
		description,
		segments
	}: {
		data: BarDatum[];
		description: string;
		/** Names a split bar's two segments; without it a datum's `highlight` is ignored. */
		segments?: { highlighted: string; rest: string };
	} = $props();

	const selection = selectByKey(
		() => data,
		(d) => d.key
	);
	const max = $derived(Math.max(1, ...data.map((d) => d.count)));
	const showEvery = $derived(Math.ceil(data.length / 16));
	const split = $derived(segments !== undefined && data.some((d) => d.highlight));
	// One column leads: the tallest. A split chart already has its lead in the liked share.
	const lead = $derived(!split && data.some((d) => d.count > 0 && d.count < max) ? max : null);

	function share(d: BarDatum): number {
		return d.highlight && d.count > 0 ? (d.highlight.count / d.count) * 100 : 0;
	}
</script>

{#if split}
	<p class="legend">
		<span><i class="swatch highlighted"></i>{segments?.highlighted}</span>
		<span><i class="swatch"></i>{segments?.rest}</span>
	</p>
{/if}

<div class="chart" role="group" aria-label={description}>
	{#each data as d, i (d.key)}
		{#if d.count > 0}
			<button
				type="button"
				class="col"
				aria-pressed={selection.isSelected(d.key)}
				title="{d.label}: {d.count}{split && d.highlight
					? `, ${d.highlight.count} ${segments?.highlighted.toLowerCase()}`
					: ''}; click to list films"
				onclick={() => selection.toggle(d.key)}
			>
				<span class="val" data-numeric>{d.count}</span>
				<span
					class="bar"
					class:lead={d.count === lead}
					style="height: {Math.max(3, (d.count / max) * 140)}px"
				>
					{#if split}
						<span class="part" style="height: {share(d)}%"></span>
					{/if}
				</span>
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
		background: var(--bar);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}
	.bar.lead {
		background: var(--accent);
	}
	.part {
		width: 100%;
		background: var(--liked);
	}
	.legend {
		display: flex;
		gap: 16px;
		margin: 0 0 8px;
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
	}
	.legend span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.swatch {
		width: 10px;
		height: 10px;
		background: var(--bar);
	}
	.swatch.highlighted {
		background: var(--liked);
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
