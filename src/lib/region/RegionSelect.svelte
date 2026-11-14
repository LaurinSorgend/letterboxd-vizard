<script lang="ts">
	import { REGIONS, saveRegion } from './region';

	let {
		label,
		region,
		onchange
	}: { label: string; region: string; onchange: (region: string) => void } = $props();

	function pick(next: string) {
		saveRegion(next);
		onchange(next);
	}
</script>

<label>
	{label}
	<select value={region} onchange={(e) => pick(e.currentTarget.value)}>
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
