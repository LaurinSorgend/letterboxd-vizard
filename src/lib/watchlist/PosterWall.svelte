<script lang="ts">
	import { imageUrl } from '$lib/film/links';
	import PosterGrid from '$lib/posters/PosterGrid.svelte';
	import { releaseYear } from '$lib/film/release';
	import { posterOf, streamingOn, type OffersOf } from './filter';
	import type { Provider, WatchlistFilm } from '$lib/types';

	let {
		films,
		offersOf,
		services,
		showLogos
	}: {
		films: WatchlistFilm[];
		offersOf: OffersOf;
		/** Picked services, shown first on each poster. */
		services: number[];
		showLogos: boolean;
	} = $props();

	const PAGE = 240;
	const LOGOS = 3;

	function streamers(film: WatchlistFilm): Provider[] {
		const all = streamingOn(offersOf(film));
		const picked = all.filter((p) => services.includes(p.id));
		return [...picked, ...all.filter((p) => !services.includes(p.id))];
	}

	function label(film: WatchlistFilm, on: Provider[]): string {
		const year = releaseYear(film);
		const where = on.length > 0 ? `, streaming on ${on.map((p) => p.name).join(', ')}` : '';
		return `${film.name}${year ? ` (${year})` : ''}${where}`;
	}
</script>

<PosterGrid {films} page={PAGE} poster={posterOf} label={(film) => label(film, streamers(film))}>
	{#snippet overlay(film)}
		{@const on = streamers(film)}
		{#if showLogos && on.length > 0}
			<span class="logos" aria-hidden="true">
				{#each on.slice(0, LOGOS) as provider (provider.id)}
					{@const logo = imageUrl(provider.logoPath, 'w45')}
					{#if logo}
						<img src={logo} alt="" loading="lazy" />
					{/if}
				{/each}
				{#if on.length > LOGOS}
					<span class="extra">+{on.length - LOGOS}</span>
				{/if}
			</span>
		{/if}
	{/snippet}
</PosterGrid>

<style>
	.logos {
		position: absolute;
		left: 4px;
		bottom: 4px;
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.logos img {
		width: 22px;
		height: 22px;
		display: block;
		border: 1px solid var(--bg);
	}
	.extra {
		padding: 0 4px;
		font-size: var(--text-2xs);
		line-height: 22px;
		color: var(--fg);
		background: var(--bg);
		font-family: var(--font-mono);
	}
</style>
