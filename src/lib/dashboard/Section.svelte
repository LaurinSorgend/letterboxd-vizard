<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getSections } from './registry.svelte';

	let {
		id,
		title,
		nav = title,
		actions,
		children
	}: {
		id: string;
		title: string;
		/** A shorter nav label for a long title. */
		nav?: string;
		/** Controls beside the title. */
		actions?: Snippet;
		children: Snippet;
	} = $props();

	const registry = getSections();
	let element: HTMLElement;

	$effect(() => registry.add({ id, label: nav, element }));
</script>

<section {id} bind:this={element}>
	{#if actions}
		<div class="heading">
			<h2>{title}</h2>
			{@render actions()}
		</div>
	{:else}
		<h2>{title}</h2>
	{/if}
	{@render children()}
</section>

<style>
	section {
		margin: 32px 0;
	}
	section:first-of-type {
		margin-top: 24px;
	}
	.heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px 16px;
		flex-wrap: wrap;
	}
	.heading h2 {
		margin: 0;
	}
	/* Two charts side by side, stacked once the column gets narrow. */
	section :global(.pair) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 32px;
		align-items: start;
	}
	@media (max-width: 900px) {
		section :global(.pair) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	section :global(h3.spaced) {
		margin-top: 24px;
	}
	section :global(.chart-note) {
		color: var(--fg-secondary);
		margin: 4px 0 16px;
	}
</style>
