<script lang="ts">
	import type { Snippet } from 'svelte';
	import { BIN_COUNT, binColor, type Ramp } from './ramp';

	let {
		ramp = 'map',
		titles = [],
		less,
		more,
		min,
		max,
		keys
	}: {
		ramp?: Ramp;
		/** Hover text per bin. */
		titles?: string[];
		less: string;
		more: string;
		/** The scale's real endpoints, shown in brackets after `less` and `more`. */
		min?: string;
		max?: string;
		/** Keys for values off the ramp, as `<span><i class="swatch few|none"></i>label</span>`. */
		keys?: Snippet;
	} = $props();
</script>

<div class="legend" aria-hidden="true">
	<span class="end">
		{less}
		{#if min !== undefined}<span data-numeric>({min})</span>{/if}
	</span>
	<span class="scale">
		{#each { length: BIN_COUNT }, i (i)}
			<i class="swatch" style:background={binColor(i, ramp)} title={titles[i]}></i>
		{/each}
	</span>
	<span class="end">
		{more}
		{#if max !== undefined}<span data-numeric>({max})</span>{/if}
	</span>
	{@render keys?.()}
</div>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-top: 8px;
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
	}
	.legend > :global(span) {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.end {
		color: var(--fg-muted);
	}
	.legend :global(.swatch) {
		width: 14px;
		height: 14px;
		display: inline-block;
	}
	/* Off-ramp keys: no ratings, nothing at all. */
	.legend :global(.swatch.few) {
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.legend :global(.swatch.none) {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}
</style>
