<script lang="ts">
	import { USERNAME_PATTERN } from '$lib/types';
	import { normalizeUsername } from '$lib/username';

	let {
		value = $bindable(''),
		onsubmit
	}: { value?: string; onsubmit: (username: string) => void } = $props();
	let invalid = $state(false);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const name = normalizeUsername(value);
		if (!USERNAME_PATTERN.test(name)) {
			invalid = true;
			return;
		}
		invalid = false;
		value = name;
		onsubmit(name);
	}
</script>

<form class="username" onsubmit={submit}>
	<label for="lb-username">No export? Use your Letterboxd username or profile link</label>
	<div class="row">
		<input
			id="lb-username"
			type="text"
			bind:value
			oninput={() => (invalid = false)}
			autocomplete="username"
			autocapitalize="none"
			spellcheck="false"
			placeholder="username"
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={invalid ? 'lb-username-error' : undefined}
			required
		/>
		<button type="submit">Load</button>
	</div>
	{#if invalid}
		<p id="lb-username-error" class="field-error">
			Enter a Letterboxd username like filmfan99, or paste your profile link.
		</p>
	{/if}
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
	.field-error {
		margin: 0;
		color: var(--error);
		font-size: var(--text-sm);
	}
</style>
