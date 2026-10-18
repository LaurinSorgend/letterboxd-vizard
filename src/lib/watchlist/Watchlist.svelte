<script lang="ts" module>
	import type { RegionOffers } from '$lib/types';

	/** Offers per region, kept across mounts so switching views or countries back costs no requests. */
	const offerCache = new Map<string, Map<string, RegionOffers | null>>();

	function cacheFor(region: string): Map<string, RegionOffers | null> {
		let cached = offerCache.get(region);
		if (!cached) offerCache.set(region, (cached = new Map()));
		return cached;
	}
</script>

<script lang="ts">
	import { fetchProviders } from '$lib/ingest/enrich';
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
	import { initialRegion, loadServices, saveRegion, saveServices } from './region';
	import WatchlistControls from './WatchlistControls.svelte';
	import WatchlistFacets from './WatchlistFacets.svelte';
	import ServicePicker from './ServicePicker.svelte';
	import PosterWall from './PosterWall.svelte';
	import RandomPick from './RandomPick.svelte';
	import { offersKey, type WatchlistFilm } from '$lib/types';

	let { watchlist, onupload }: { watchlist: WatchlistFilm[]; onupload: () => void } = $props();

	const startRegion = initialRegion();
	let region = $state(startRegion);
	let offers = $state(new Map<string, RegionOffers | null>());
	let loaded = $state({ done: 0, total: 0 });
	let unresolved = $state(0);
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
	const offersOf: OffersOf = (film) => (film.tmdb ? offers.get(offersKey(film.tmdb)) : null);

	const loading = $derived(loaded.done < loaded.total);
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
		void loadOffers(region, titles, controller.signal);
		return () => controller.abort();
	});

	/** Fetches only the titles this region's cache lacks; an aborted load leaves the state alone. */
	async function loadOffers(forRegion: string, items: typeof titles, signal: AbortSignal) {
		const cached = cacheFor(forRegion);
		const missing = items.filter((item) => !cached.has(offersKey(item)));
		offers = new Map(cached);
		unresolved = 0;
		loaded = { done: 0, total: missing.length };
		if (missing.length === 0) return;
		const found = await fetchProviders(
			missing,
			forRegion,
			(done, total) => {
				if (!signal.aborted) loaded = { done, total };
			},
			signal
		);
		for (const [key, value] of found.offers) cached.set(key, value);
		if (signal.aborted) return;
		offers = new Map(cached);
		unresolved = found.unresolved;
		loaded = { done: missing.length, total: missing.length };
	}

	function changeRegion(next: string) {
		region = next;
		saveRegion(next);
		filters.services = loadServices(next);
	}

	$effect(() => saveServices(region, filters.services));

	function reset() {
		filters = { ...NO_FILTERS, services: filters.services };
	}
</script>

{#if watchlist.length === 0}
	<div class="empty">
		<p>
			Your watchlist comes from the <code>watchlist.csv</code> in your Letterboxd export. A library loaded
			by username has none, since Letterboxd's RSS feed leaves the watchlist out.
		</p>
		<button type="button" onclick={onupload}>Upload an export</button>
	</div>
{:else}
	<div class="watchlist">
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
				Checking where your watchlist streams… {loaded.done} / {loaded.total}
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
{/if}

<style>
	.watchlist :global(select),
	.watchlist :global(input:not([type='checkbox'])),
	.watchlist :global(button:not(.link)),
	.empty button {
		font: inherit;
		font-size: var(--text-sm);
		padding: 4px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		min-width: 0;
	}
	.watchlist :global(button:not(.link)),
	.empty button {
		cursor: pointer;
	}
	.watchlist :global(button:not(.link):hover),
	.empty button:hover {
		background: var(--surface);
	}
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
	.empty {
		padding: 24px 0;
		color: var(--fg-secondary);
	}
</style>
