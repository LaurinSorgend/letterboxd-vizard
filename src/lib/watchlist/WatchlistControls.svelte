<script lang="ts">
	import { REGIONS } from './region';
	import type { WatchFilters, WatchSort } from './filter';

	let {
		region,
		onregion,
		filters = $bindable(),
		sort = $bindable(),
		showLogos = $bindable(),
		onshuffle,
		onreset
	}: {
		region: string;
		onregion: (region: string) => void;
		filters: WatchFilters;
		sort: WatchSort;
		showLogos: boolean;
		onshuffle: () => void;
		onreset: () => void;
	} = $props();

	const SORTS: { value: WatchSort; label: string }[] = [
		{ value: 'added-desc', label: 'Recently added' },
		{ value: 'added-asc', label: 'Added longest ago' },
		{ value: 'release-desc', label: 'Newest release' },
		{ value: 'release-asc', label: 'Oldest release' },
		{ value: 'rating', label: 'TMDB rating' },
		{ value: 'popularity', label: 'Most popular' },
		{ value: 'runtime-asc', label: 'Shortest' },
		{ value: 'runtime-desc', label: 'Longest' },
		{ value: 'title', label: 'Title A–Z' },
		{ value: 'shuffle', label: 'Shuffled' }
	];
</script>

<div class="controls">
	<label>
		I watch in
		<select value={region} onchange={(e) => onregion(e.currentTarget.value)}>
			{#each REGIONS as option (option.code)}
				<option value={option.code}>{option.name}</option>
			{/each}
		</select>
	</label>
	<label>
		Availability
		<select bind:value={filters.availability}>
			<option value="any">Everything</option>
			<option value="stream">Streaming (subscription or free)</option>
			<option value="free">Free, with or without ads</option>
			<option value="rent">To rent or buy</option>
			<option value="none">Not streaming</option>
		</select>
	</label>
	<label class="search">
		Search
		<input type="search" placeholder="Title, director, actor" bind:value={filters.query} />
	</label>
	<label>
		Order
		<select bind:value={sort}>
			{#each SORTS as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<div class="actions">
		<button type="button" onclick={onshuffle}>Shuffle</button>
		<button type="button" onclick={onreset}>Reset filters</button>
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
