<script lang="ts" module>
	import { providersFetcher } from '$lib/api/endpoints';
	import { CachedLookup, followLookup } from '$lib/api/lookup.svelte';
	import { getOrCreate } from '$lib/maps';
	import { offersKey, type ProviderRequestItem, type RegionOffers } from '$lib/types';

	type OfferLookup = CachedLookup<ProviderRequestItem, string, RegionOffers | null>;

	/** Offers per country, since catalogues differ by country. */
	const lookups = new Map<string, OfferLookup>();

	const lookupFor = (region: string): OfferLookup =>
		getOrCreate(lookups, region, () => new CachedLookup(offersKey, providersFetcher(region)));
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import {
		filterWatchlist,
		NO_FILTERS,
		posterOf,
		serviceCounts,
		sortWatchlist,
		type OffersOf,
		type SwatchOf,
		type WatchFilters,
		type WatchSort
	} from './filter';
	import { PosterPalette } from '$lib/posters/palette.svelte';
	import { region as watchRegion } from '$lib/region/region.svelte';
	import { loadServices, saveServices } from './services';
	import WatchlistControls from './WatchlistControls.svelte';
	import WatchlistFacets from './WatchlistFacets.svelte';
	import ServicePicker from './ServicePicker.svelte';
	import PosterWall from './PosterWall.svelte';
	import RandomPick from './RandomPick.svelte';
	import type { WatchlistFilm } from '$lib/types';

	let { watchlist }: { watchlist: WatchlistFilm[] } = $props();

	const region = $derived(watchRegion.code);
	const lookup = $derived(lookupFor(region));
	let filters: WatchFilters = $state({ ...NO_FILTERS, services: loadServices(watchRegion.code) });
	let sort: WatchSort = $state('added-desc');
	let seed = $state(0);
	let showLogos = $state(true);
	const palette = new PosterPalette();

	const titles = $derived(
		watchlist.flatMap((f) =>
			f.tmdb ? [{ tmdbId: f.tmdb.tmdbId, mediaType: f.tmdb.mediaType }] : []
		)
	);
	const offersOf: OffersOf = (film) => (film.tmdb ? lookup.values.get(offersKey(film.tmdb)) : null);

	const loading = $derived(lookup.loading);
	const unresolved = $derived(lookup.unresolved(titles));
	const counts = $derived(serviceCounts(watchlist, offersOf));
	const filtered = $derived(filterWatchlist(watchlist, filters, offersOf));
	const swatchOf: SwatchOf = (film) => palette.swatchOf(posterOf(film));
	const shown = $derived(sortWatchlist(filtered, sort, seed, swatchOf));

	followLookup(
		() => lookup,
		() => titles
	);

	// Saved services follow the region, wherever it is changed; reloading them before the save
	// effect runs keeps one region's services from being saved under another.
	$effect.pre(() => {
		const current = region;
		untrack(() => (filters.services = loadServices(current)));
	});

	$effect(() => saveServices(region, filters.services));

	function reset() {
		filters = { ...NO_FILTERS, services: filters.services };
	}
</script>

<div class="form-controls">
	<WatchlistControls
		bind:filters
		bind:sort
		bind:showLogos
		onshuffle={() => ((sort = 'shuffle'), (seed += 1))}
		onreset={reset}
		{palette}
		posters={filtered.map(posterOf)}
	/>
	<ServicePicker {counts} {loading} bind:selected={filters.services} />
	<WatchlistFacets films={watchlist} bind:filters />

	<p class="summary" role="status">
		{#if loading}
			Checking where your watchlist streams… {lookup.progress.done} / {lookup.progress.total}
		{:else}
			<span data-numeric>{shown.length}</span> of <span data-numeric>{watchlist.length}</span> films
			{#if unresolved > 0}
				· Could not check where <span data-numeric>{unresolved}</span>
				{unresolved === 1 ? 'film streams' : 'films stream'}, so the availability filters leave
				{unresolved === 1 ? 'it' : 'them'} out.
			{/if}
		{/if}
	</p>

	<RandomPick films={shown} {offersOf} {loading} />
	<PosterWall films={shown} {offersOf} services={filters.services} {showLogos} />

	<p class="credit">
		Streaming availability from <a href="https://www.justwatch.com">JustWatch</a>, via TMDB.
	</p>
</div>
