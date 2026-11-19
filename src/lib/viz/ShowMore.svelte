<script lang="ts">
	import { PAGE_STEP, type Pager } from './pager.svelte';

	let { pager }: { pager: Pager } = $props();
</script>

{#if pager.pageable}
	{#if pager.remaining > 0}
		<button type="button" class="more" onclick={pager.more}>
			Show <span data-numeric>{Math.min(PAGE_STEP, pager.remaining)}</span> more (<span
				data-numeric>{pager.remaining}</span
			> left)
		</button>
	{:else}
		<button type="button" class="more" onclick={pager.reset}>Show fewer</button>
	{/if}
{/if}

<style>
	.more {
		margin-top: 8px;
		padding: 4px 12px;
		font: inherit;
		font-size: var(--text-sm);
		color: var(--fg);
		background: transparent;
		border: 1px solid var(--border);
		cursor: pointer;
	}
	.more:hover {
		background: var(--surface);
	}
</style>
