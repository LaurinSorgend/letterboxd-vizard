<script lang="ts">
	let {
		checked,
		error = null,
		onchange
	}: { checked: boolean; error?: string | null; onchange: (value: boolean) => void } = $props();
</script>

<div class="remember">
	<label>
		<input type="checkbox" {checked} onchange={(e) => onchange(e.currentTarget.checked)} />
		<span>Remember my data on this device</span>
	</label>
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
</div>

<style>
	.remember {
		margin: 8px 0 24px;
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		color: var(--fg-secondary);
		font-size: var(--text-base);
	}
	input {
		accent-color: var(--accent);
		width: 16px;
		height: 16px;
	}
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.error {
		margin: 4px 0 0;
		font-size: var(--text-base);
		color: var(--error);
	}
</style>
