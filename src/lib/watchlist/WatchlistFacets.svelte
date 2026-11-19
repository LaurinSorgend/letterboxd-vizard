<script lang="ts">
	import { countryName } from '$lib/film/countries';
	import { languageName } from '$lib/film/language';
	import { countriesOf, type WatchFilters } from './filter';
	import type { WatchlistFilm } from '$lib/types';

	let { films, filters = $bindable() }: { films: WatchlistFilm[]; filters: WatchFilters } =
		$props();

	/** Each value present in the watchlist with how many films carry it, alphabetical. */
	function tally(keysOf: (film: WatchlistFilm) => string[], name: (key: string) => string) {
		const counts = new Map<string, number>();
		for (const film of films)
			for (const key of keysOf(film)) counts.set(key, (counts.get(key) ?? 0) + 1);
		return [...counts]
			.map(([value, count]) => ({ value, label: `${name(value)} (${count})` }))
			.sort((a, b) => a.label.localeCompare(b.label));
	}

	const genres = $derived(
		tally(
			(f) => f.tmdb?.genres ?? [],
			(g) => g
		)
	);
	const languages = $derived(
		tally(
			(f) => (f.tmdb?.originalLanguage ? [languageName(f.tmdb.originalLanguage)] : []),
			(name) => name
		)
	);
	const countries = $derived(tally(countriesOf, countryName));
	const hasSeries = $derived(films.some((f) => f.tmdb?.mediaType === 'tv'));

	const RUNTIMES = [90, 100, 120, 150];
	const RATINGS = [5, 6, 6.5, 7, 7.5, 8];

	/** Number inputs hand back '' when cleared; the filter wants null for "no bound". */
	function year(value: string): number | null {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}
</script>

<div class="facets">
	{#if hasSeries}
		<label>
			Type
			<select bind:value={filters.mediaType}>
				<option value="all">Films and series</option>
				<option value="movie">Films</option>
				<option value="tv">Series</option>
			</select>
		</label>
	{/if}
	<label>
		Genre
		<select bind:value={filters.genre}>
			<option value="">Any genre</option>
			{#each genres as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<label>
		Language
		<select bind:value={filters.language}>
			<option value="">Any language</option>
			{#each languages as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<label>
		Country of origin
		<select bind:value={filters.country}>
			<option value="">Any country</option>
			{#each countries as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<label>
		Released from
		<input
			type="number"
			inputmode="numeric"
			placeholder="Year"
			min="1870"
			max="2100"
			value={filters.fromYear ?? ''}
			oninput={(e) => (filters.fromYear = year(e.currentTarget.value))}
		/>
	</label>
	<label>
		Released until
		<input
			type="number"
			inputmode="numeric"
			placeholder="Year"
			min="1870"
			max="2100"
			value={filters.toYear ?? ''}
			oninput={(e) => (filters.toYear = year(e.currentTarget.value))}
		/>
	</label>
	<label>
		Runtime
		<select bind:value={filters.maxRuntime}>
			<option value={null}>Any length</option>
			{#each RUNTIMES as minutes (minutes)}
				<option value={minutes}>Up to {minutes} min</option>
			{/each}
		</select>
	</label>
	<label>
		TMDB rating
		<select bind:value={filters.minRating}>
			<option value={null}>Any rating</option>
			{#each RATINGS as rating (rating)}
				<option value={rating}>{rating}+</option>
			{/each}
		</select>
	</label>
</div>

<style>
	.facets {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 12px;
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
	input[type='number'] {
		font-family: var(--font-mono);
	}
</style>
