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
	{:else}
		<p class="hint">
			{checked
				? 'Saved in this browser only; never uploaded. Untick to forget it.'
				: 'Tick to keep your analysed data in this browser so you can skip the upload next time.'}
		</p>
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
		font-size: 0.875rem;
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
	.hint {
		margin: 4px 0 0;
		font-size: 0.75rem;
		color: var(--fg-muted);
	}
	.error {
		margin: 4px 0 0;
		font-size: 0.75rem;
		color: var(--error);
	}
</style>
