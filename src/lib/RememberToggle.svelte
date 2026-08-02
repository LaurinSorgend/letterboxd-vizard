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
				? 'Saved in this browser only, never uploaded. Untick to forget it.'
				: 'Keeps your analysed data in this browser; next visit skips the upload.'}
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
	/* Sentence-length help text, so it stays at the 16px floor and takes its
	 * secondary rank from colour rather than size. */
	.hint {
		margin: 4px 0 0;
		font-size: var(--text-base);
		color: var(--fg-muted);
	}
	.error {
		margin: 4px 0 0;
		font-size: var(--text-base);
		color: var(--error);
	}
</style>
