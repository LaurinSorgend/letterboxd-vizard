<script lang="ts">
	let { tiles }: { tiles: { label: string; value: string }[] } = $props();
</script>

<div class="tiles">
	{#each tiles as tile (tile.label)}
		<div class="tile">
			<span class="label">{tile.label}</span>
			<span class="value">{tile.value}</span>
		</div>
	{/each}
</div>

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px;
	}
	.tile {
		background: var(--bg-secondary);
		border-radius: 4px;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.label {
		font-size: 0.875rem;
		color: var(--fg-secondary);
	}
	.value {
		font-size: 1.5rem;
		font-weight: 600;
	}
</style>
