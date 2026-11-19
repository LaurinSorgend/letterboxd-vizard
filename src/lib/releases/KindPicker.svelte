<script lang="ts">
	import { RELEASE_KINDS, type ReleaseKind } from '$lib/types';
	import { KINDS } from './kinds';

	let { legend, kinds = $bindable() }: { legend: string; kinds: ReleaseKind[] } = $props();
</script>

<fieldset>
	<legend>{legend}</legend>
	{#each RELEASE_KINDS as kind (kind)}
		<label style:--kind-colour={KINDS[kind].colour}>
			<input type="checkbox" value={kind} bind:group={kinds} />
			<span class="swatch" aria-hidden="true"></span>
			{KINDS[kind].label}
		</label>
	{/each}
</fieldset>

<style>
	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		border: none;
		margin: 0;
		padding: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		cursor: pointer;
	}
	input {
		accent-color: var(--accent);
		margin: 0;
	}
	.swatch {
		width: 10px;
		height: 10px;
		background: var(--kind-colour);
	}
</style>
