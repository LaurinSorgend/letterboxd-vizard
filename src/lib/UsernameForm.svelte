<script lang="ts">
	let { onsubmit }: { onsubmit: (username: string) => void } = $props();
	let username = $state('');
</script>

<form
	class="username"
	onsubmit={(e) => {
		e.preventDefault();
		if (username.trim()) onsubmit(username.trim());
	}}
>
	<label for="lb-username">No export? Use your Letterboxd username</label>
	<div class="row">
		<input
			id="lb-username"
			type="text"
			bind:value={username}
			autocomplete="username"
			autocapitalize="none"
			spellcheck="false"
			pattern="[A-Za-z0-9_]{'{'}2,30{'}'}"
			placeholder="username"
			required
		/>
		<button type="submit">Load</button>
	</div>
	<p class="hint">
		Reads your public RSS feed, which only holds your 50 most recent diary entries. With "Remember"
		on, each visit adds whatever you logged since. Upload the export for your full history.
	</p>
</form>

<style>
	.username {
		margin-top: 24px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	label {
		color: var(--fg-secondary);
	}
	.row {
		display: flex;
		gap: 8px;
	}
	input,
	button {
		font: inherit;
		padding: 6px 10px;
		color: var(--fg);
		border: 1px solid var(--border-strong);
	}
	input {
		flex: 1;
		min-width: 0;
		max-width: 320px;
		background: var(--bg);
	}
	button {
		background: var(--bg-secondary);
		cursor: pointer;
	}
	button:hover {
		background: var(--surface);
	}
	input:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.hint {
		margin: 0;
		font-size: var(--text-base);
		color: var(--fg-muted);
		max-width: 60ch;
	}
</style>
