<script lang="ts">
	import RegionSelect from '$lib/region/RegionSelect.svelte';
	import type { WatchFilters, WatchSort } from './filter';

	let {
		region,
		onregion,
		filters = $bindable(),
		sort = $bindable(),
		showLogos = $bindable(),
		onshuffle,
		onreset,
		colours,
		oncolours
	}: {
		region: string;
		onregion: (region: string) => void;
		filters: WatchFilters;
		sort: WatchSort;
		showLogos: boolean;
		onshuffle: () => void;
		onreset: () => void;
		/** Colour sort state: whether any swatches exist, how many posters are left to read. */
		colours: {
			ready: boolean;
			unread: number;
			reading: boolean;
			progress: number;
			refused: boolean;
		};
		oncolours: () => void;
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
	<RegionSelect label="I watch in" {region} onchange={onregion} />
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
			<option value="colour" disabled={!colours.ready}>Colour spectrum</option>
		</select>
	</label>
	<div class="actions">
		<button type="button" onclick={onshuffle}>Shuffle</button>
		<button type="button" onclick={onreset}>Reset filters</button>
		{#if !colours.refused && colours.unread > 0}
			<button type="button" onclick={oncolours} disabled={colours.reading}>
				{colours.reading ? 'Reading colours…' : 'Sort by colour'}
			</button>
		{/if}
		{#if colours.reading}
			<progress value={colours.progress} max={colours.unread} aria-label="Reading poster colours"
			></progress>
		{/if}
		<label class="inline">
			<input type="checkbox" bind:checked={showLogos} />
			Logos on posters
		</label>
	</div>
	{#if colours.refused}
		<p class="note">
			Colour sorting needs pixel access to the posters, which this browser blocks for TMDB images.
			The other orderings still work.
		</p>
	{/if}
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
	progress {
		width: 160px;
		accent-color: var(--accent);
	}
	.note {
		grid-column: 1 / -1;
		margin: 0;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
</style>
