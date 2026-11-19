<script lang="ts">
	import {
		ACCENTS,
		applyAccent,
		applyFlavor,
		FLAVORS,
		savedAccent,
		savedFlavor,
		SYSTEM_FLAVOR
	} from '$lib/theme';

	let flavor = $state(savedFlavor());
	let accent = $state(savedAccent());
</script>

<div class="switches">
	<label>
		Theme
		<select bind:value={flavor} onchange={() => applyFlavor(flavor)}>
			<option value={SYSTEM_FLAVOR}>System</option>
			{#each FLAVORS as { value, label } (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
	<label>
		Accent
		<select bind:value={accent} onchange={() => applyAccent(accent)}>
			{#each ACCENTS as { value, label } (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
</div>

<style>
	.switches {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px 12px;
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	select {
		background: var(--surface);
		color: var(--fg);
		border: 1px solid var(--border);
		padding: 4px 8px;
		min-width: 0;
		font: inherit;
	}
</style>
