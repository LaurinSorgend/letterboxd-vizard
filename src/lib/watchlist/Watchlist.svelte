<script lang="ts" module>
	import { fetchProviders } from '$lib/ingest/enrich';
	import { CachedLookup } from '$lib/ingest/lookup.svelte';
	import { offersKey, type ProviderRequestItem, type RegionOffers } from '$lib/types';

	type OfferLookup = CachedLookup<ProviderRequestItem, string, RegionOffers | null>;

	/** Offers per country, since catalogues differ by country. */
	const lookups = new Map<string, OfferLookup>();

	function lookupFor(region: string): OfferLookup {
		let lookup = lookups.get(region);
		if (!lookup) {
			lookup = new CachedLookup(offersKey, (items, onProgress, signal) =>
				fetchProviders(items, region, onProgress, signal)
			);
			lookups.set(region, lookup);
		}
		return lookup;
	}
</script>

<script lang="ts">
	import {
		filterWatchlist,
		NO_FILTERS,
		posterUrl,
		serviceCounts,
		sortWatchlist,
		type OffersOf,
		type SwatchOf,
		type WatchFilters,
		type WatchSort
	} from './filter';
	import { extractPalette, type Swatch } from '$lib/viz/colors';
	import { initialRegion } from '$lib/region/region';
	import { loadServices, saveServices } from './services';
	import WatchlistControls from './WatchlistControls.svelte';
	import WatchlistFacets from './WatchlistFacets.svelte';
	import ServicePicker from './ServicePicker.svelte';
	import PosterWall from './PosterWall.svelte';
	import RandomPick from './RandomPick.svelte';
	import type { WatchlistFilm } from '$lib/types';

	let { watchlist }: { watchlist: WatchlistFilm[] } = $props();

	const startRegion = initialRegion();
	let region = $state(startRegion);
	let lookup = $state.raw(lookupFor(startRegion));
	let filters: WatchFilters = $state({ ...NO_FILTERS, services: loadServices(startRegion) });
	let sort: WatchSort = $state('added-desc');
	let seed = $state(0);
	let showLogos = $state(true);
	let palette: Map<string, Swatch> = $state(new Map());
	let colours = $state({ reading: false, progress: 0, refused: false });

	const titles = $derived(
		watchlist.flatMap((f) =>
			f.tmdb ? [{ tmdbId: f.tmdb.tmdbId, mediaType: f.tmdb.mediaType }] : []
		)
	);
	const offersOf: OffersOf = (film) => (film.tmdb ? lookup.values.get(offersKey(film.tmdb)) : null);

	const loading = $derived(lookup.loading);
	const unresolved = $derived(loading ? 0 : lookup.missing(titles));
	const counts = $derived(serviceCounts(watchlist, offersOf));
	const filtered = $derived(filterWatchlist(watchlist, filters, offersOf));
	const swatchOf: SwatchOf = (film) => {
		const url = posterUrl(film);
		return url ? palette.get(url) : undefined;
	};
	const shown = $derived(sortWatchlist(filtered, sort, seed, swatchOf));
	const unread = $derived(
		[...new Set(filtered.map(posterUrl).filter((url): url is string => url !== null))].filter(
			(url) => !palette.has(url)
		)
	);

	async function readColours() {
		colours.reading = true;
		colours.progress = 0;
		const found = await extractPalette(unread, (done) => (colours.progress = done));
		colours.reading = false;
		if (!found) {
			colours.refused = true;
			return;
		}
		palette = new Map([...palette, ...found]);
		sort = 'colour';
	}

	$effect(() => {
		const controller = new AbortController();
		void lookup.load(titles, controller.signal);
		return () => controller.abort();
	});

	function changeRegion(next: string) {
		region = next;
		lookup = lookupFor(next);
		filters.services = loadServices(next);
	}

	$effect(() => saveServices(region, filters.services));

	function reset() {
		filters = { ...NO_FILTERS, services: filters.services };
	}
</script>

<div class="form-controls">
	<WatchlistControls
		{region}
		onregion={changeRegion}
		bind:filters
		bind:sort
		bind:showLogos
		onshuffle={() => ((sort = 'shuffle'), (seed += 1))}
		onreset={reset}
		colours={{ ...colours, ready: palette.size > 0, unread: unread.length }}
		oncolours={readColours}
	/>
	<ServicePicker {counts} {loading} bind:selected={filters.services} />
	<WatchlistFacets films={watchlist} bind:filters />

	<p class="summary" role="status">
		{#if loading}
			Checking where your watchlist streams… {lookup.progress.done} / {lookup.progress.total}
		{:else}
			<span class="num">{shown.length}</span> of <span class="num">{watchlist.length}</span> films
			{#if unresolved > 0}
				· Could not check where <span class="num">{unresolved}</span>
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

<style>
	.summary {
		margin: 0 0 12px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.num {
		font-family: var(--font-mono);
	}
	.credit {
		margin-top: 16px;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
</style>
