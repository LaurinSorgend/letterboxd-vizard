<script lang="ts">
	import { USERNAME_PATTERN } from '$lib/types';

	let { onsubmit }: { onsubmit: (username: string) => void } = $props();
	let username = $state('');
</script>

<form
	class="username"
	onsubmit={(e) => {
		e.preventDefault();
		const name = username.trim();
		if (name) onsubmit(name);
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
			pattern={USERNAME_PATTERN.source.slice(1, -1)}
			placeholder="username"
			required
		/>
		<button type="submit">Load</button>
	</div>
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
</style>
