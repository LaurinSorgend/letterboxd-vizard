<script lang="ts">
	import { region, REGIONS } from './region.svelte';

	let { label }: { label: string } = $props();
</script>

<label>
	{label}
	<select value={region.code} onchange={(e) => (region.code = e.currentTarget.value)}>
		{#each REGIONS as option (option.code)}
			<option value={option.code}>{option.name}</option>
		{/each}
	</select>
</label>

<style>
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		min-width: 0;
	}
</style>
