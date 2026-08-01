<script lang="ts">
	let { onfile }: { onfile: (file: File) => void } = $props();
	let dragover = $state(false);
</script>

<label
	class="drop"
	class:dragover
	ondragover={(e) => {
		e.preventDefault();
		dragover = true;
	}}
	ondragleave={() => (dragover = false)}
	ondrop={(e) => {
		e.preventDefault();
		dragover = false;
		const file = e.dataTransfer?.files[0];
		if (file) onfile(file);
	}}
>
	<input
		type="file"
		accept=".zip,application/zip"
		onchange={(e) => {
			const file = e.currentTarget.files?.[0];
			if (file) onfile(file);
		}}
	/>
	<strong>Drop your Letterboxd export zip here</strong>
	<span>or click to choose the file</span>
	<span class="hint">
		Get it from letterboxd.com → Settings → Data → Export your data. Your data is analyzed in your
		browser; only film titles are sent to look up movie metadata.
	</span>
</label>

<style>
	.drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 48px 24px;
		border: 2px dashed var(--border-strong);
		background: var(--bg-secondary);
		cursor: pointer;
		text-align: center;
	}
	.drop.dragover {
		border-color: var(--accent);
		background: var(--surface);
	}
	.drop:has(input:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	span {
		color: var(--fg-secondary);
	}
	.hint {
		font-size: var(--text-base);
		color: var(--fg-muted);
		max-width: 48ch;
	}
</style>
