<script lang="ts">
	let { tiles }: { tiles: { label: string; value: string }[] } = $props();
</script>

<!-- A ledger row rather than a set of equal cards: figures under hairline rules, the first one
     (the count everything else is measured against) under an accent rule. -->
<dl class="tiles">
	{#each tiles as tile, i (tile.label)}
		<div class="tile" class:lead={i === 0}>
			<dt class="label">{tile.label}</dt>
			<dd class="value metric">{tile.value}</dd>
		</div>
	{/each}
</dl>

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 16px 24px;
		margin: 0;
	}
	.tile {
		padding-top: 12px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tile.lead {
		border-top: 2px solid var(--accent);
		padding-top: 11px;
	}
	.label {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.value {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: 500;
		line-height: var(--leading-snug);
		color: var(--fg);
	}
</style>
