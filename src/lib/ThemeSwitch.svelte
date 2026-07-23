<script lang="ts">
	import { browser } from '$app/environment';

	const flavors = [
		['latte', 'Latte'],
		['frappe', 'Frappé'],
		['macchiato', 'Macchiato'],
		['mocha', 'Mocha']
	];
	const accents = [
		['rosewater', 'Rosewater'],
		['flamingo', 'Flamingo'],
		['pink', 'Pink'],
		['mauve', 'Mauve'],
		['red', 'Red'],
		['maroon', 'Maroon'],
		['peach', 'Peach'],
		['yellow', 'Yellow'],
		['green', 'Green'],
		['teal', 'Teal'],
		['sky', 'Sky'],
		['sapphire', 'Sapphire'],
		['blue', 'Blue'],
		['lavender', 'Lavender']
	];

	let flavor = $state(
		browser && flavors.some(([value]) => value === localStorage.getItem('flavor'))
			? (localStorage.getItem('flavor') as string)
			: 'system'
	);
	let accent = $state(
		browser && accents.some(([value]) => value === localStorage.getItem('accent'))
			? (localStorage.getItem('accent') as string)
			: 'blue'
	);

	function applyFlavor(value: string) {
		if (value === 'system') {
			localStorage.removeItem('flavor');
			delete document.documentElement.dataset.flavor;
		} else {
			localStorage.setItem('flavor', value);
			document.documentElement.dataset.flavor = value;
		}
	}

	function applyAccent(value: string) {
		if (value === 'blue') {
			localStorage.removeItem('accent');
			delete document.documentElement.dataset.accent;
		} else {
			localStorage.setItem('accent', value);
			document.documentElement.dataset.accent = value;
		}
	}
</script>

<div class="switches">
	<label>
		Theme
		<select bind:value={flavor} onchange={() => applyFlavor(flavor)}>
			<option value="system">System</option>
			{#each flavors as [value, name] (value)}
				<option {value}>{name}</option>
			{/each}
		</select>
	</label>
	<label>
		Accent
		<select bind:value={accent} onchange={() => applyAccent(accent)}>
			{#each accents as [value, name] (value)}
				<option {value}>{name}</option>
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
		font-size: 0.875rem;
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
