<script lang="ts">
	import { fetchProviders, offersKey } from '$lib/ingest/enrich';
	import {
		filterWatchlist,
		NO_FILTERS,
		serviceCounts,
		sortWatchlist,
		type OffersOf,
		type WatchFilters,
		type WatchSort
	} from './filter';
	import { initialRegion, loadServices, saveRegion, saveServices } from './region';
	import WatchlistControls from './WatchlistControls.svelte';
	import WatchlistFacets from './WatchlistFacets.svelte';
	import ServicePicker from './ServicePicker.svelte';
	import PosterWall from './PosterWall.svelte';
	import RandomPick from './RandomPick.svelte';
	import type { RegionOffers, WatchlistFilm } from '$lib/types';

	let {
		watchlist,
		looking = false,
		onupload
	}: {
		watchlist: WatchlistFilm[];
		/** True while the watchlist's own TMDB records are still being fetched. */
		looking?: boolean;
		onupload: () => void;
	} = $props();

	const startRegion = initialRegion();
	let region = $state(startRegion);
	let offers = $state(new Map<string, RegionOffers | null>());
	let loaded = $state({ done: 0, total: 0 });
	let failed = $state(false);
	let filters: WatchFilters = $state({ ...NO_FILTERS, services: loadServices(startRegion) });
	let sort: WatchSort = $state('added-desc');
	let seed = $state(0);
	let showLogos = $state(true);

	const titles = $derived(
		watchlist.flatMap((f) =>
			f.tmdb ? [{ tmdbId: f.tmdb.tmdbId, mediaType: f.tmdb.mediaType }] : []
		)
	);
	const offersOf: OffersOf = (film) => (film.tmdb ? offers.get(offersKey(film.tmdb)) : null);

	const loading = $derived(loaded.done < loaded.total);
	const counts = $derived(serviceCounts(watchlist, offersOf));
	const shown = $derived(sortWatchlist(filterWatchlist(watchlist, filters, offersOf), sort, seed));

	$effect(() => {
		void loadOffers(region, titles);
	});

	/** Bumped per load, so a slow answer for a country the viewer already left is dropped. */
	let generation = 0;

	async function loadOffers(forRegion: string, items: typeof titles) {
		const mine = ++generation;
		const current = () => mine === generation;
		failed = false;
		loaded = { done: 0, total: items.length };
		offers = new Map();
		try {
			const found = await fetchProviders(items, forRegion, (done, total) => {
				if (current()) loaded = { done, total };
			});
			if (current()) offers = found;
		} catch {
			if (current()) failed = true;
		} finally {
			if (current()) loaded = { done: items.length, total: items.length };
		}
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
		/>
		<ServicePicker {counts} bind:selected={filters.services} />
		<WatchlistFacets films={watchlist} bind:filters />

		<p class="summary" role="status">
			{#if looking}
				Looking up your watchlist on TMDB…
			{:else if loading}
				Checking where your watchlist streams… {loaded.done} / {loaded.total}
			{:else if failed}
				Could not load streaming availability this time; the other filters still work.
			{:else}
				<span class="num">{shown.length}</span> of <span class="num">{watchlist.length}</span> films
			{/if}
		</p>

		<RandomPick films={shown} {offersOf} />
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
