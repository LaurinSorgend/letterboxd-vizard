<script lang="ts">
	import ColourSortButton from '$lib/posters/ColourSortButton.svelte';
	import type { PosterPalette } from '$lib/posters/palette.svelte';
	import RegionSelect from '$lib/region/RegionSelect.svelte';
	import { AVAILABILITY_OPTIONS, SORT_OPTIONS, type WatchFilters, type WatchSort } from './filter';

	let {
		filters = $bindable(),
		sort = $bindable(),
		showLogos = $bindable(),
		onshuffle,
		onreset,
		palette,
		posters
	}: {
		filters: WatchFilters;
		sort: WatchSort;
		showLogos: boolean;
		onshuffle: () => void;
		onreset: () => void;
		palette: PosterPalette;
		/** Posters the colour sort would read. */
		posters: (string | null)[];
	} = $props();
</script>

<div class="controls">
	<RegionSelect label="I watch in" />
	<label>
		Availability
		<select bind:value={filters.availability}>
			{#each AVAILABILITY_OPTIONS as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<label class="search">
		Search
		<input type="search" placeholder="Title, director, actor" bind:value={filters.query} />
	</label>
	<label>
		Order
		<select bind:value={sort}>
			{#each SORT_OPTIONS as option (option.value)}
				<option
					value={option.value}
					disabled={'needsPalette' in option && option.needsPalette && !palette.ready}
					>{option.label}</option
				>
			{/each}
		</select>
	</label>
	<div class="actions">
		<button type="button" onclick={onshuffle}>Shuffle</button>
		<button type="button" onclick={onreset}>Reset filters</button>
		<ColourSortButton {palette} urls={posters} onread={() => (sort = 'colour')} />
		<label class="inline">
			<input type="checkbox" bind:checked={showLogos} />
			Logos on posters
		</label>
	</div>
</div>

<style>
	.controls {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 12px;
		align-items: end;
		margin-bottom: 16px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		min-width: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		grid-column: 1 / -1;
	}
	label.inline {
		flex-direction: row;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	label.inline input {
		accent-color: var(--accent);
		margin: 0;
	}
</style>
