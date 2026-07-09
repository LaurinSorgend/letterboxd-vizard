<script lang="ts">
	import { browser } from '$app/environment';

	let theme = $state(
		browser && ['light', 'dark'].includes(localStorage.getItem('theme') ?? '')
			? (localStorage.getItem('theme') as 'light' | 'dark')
			: 'system'
	);

	function apply(value: string) {
		if (value === 'light' || value === 'dark') {
			localStorage.setItem('theme', value);
			document.documentElement.dataset.theme = value;
		} else {
			localStorage.removeItem('theme');
			delete document.documentElement.dataset.theme;
		}
	}
</script>

<label>
	Theme
	<select bind:value={theme} onchange={() => apply(theme)}>
		<option value="system">System</option>
		<option value="light">Light</option>
		<option value="dark">Dark</option>
	</select>
</label>

<style>
	label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 0.875rem;
		color: var(--fg-secondary);
	}
	select {
		background: var(--surface);
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 4px 8px;
		font: inherit;
	}
</style>
