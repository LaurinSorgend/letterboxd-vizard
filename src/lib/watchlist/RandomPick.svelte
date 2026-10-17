<script lang="ts">
	import { imageUrl } from '$lib/viz/images';
	import { webHref } from '$lib/viz/href';
	import { providersOf, STREAM_KINDS, type OffersOf } from './filter';
	import type { WatchlistFilm } from '$lib/types';

	let { films, offersOf }: { films: WatchlistFilm[]; offersOf: OffersOf } = $props();

	let pickedUri: string | null = $state(null);
	/** Drops the pick once the filters no longer let it through, rather than showing a stray. */
	const picked = $derived(films.find((f) => f.uri === pickedUri) ?? null);

	function pick() {
		const others = films.length > 1 ? films.filter((f) => f.uri !== pickedUri) : films;
		pickedUri = others[Math.floor(Math.random() * others.length)]?.uri ?? null;
	}

	function details(film: WatchlistFilm): string {
		const tmdb = film.tmdb;
		const parts = [
			tmdb?.year ?? film.year,
			tmdb?.runtime ? `${tmdb.runtime} min` : null,
			tmdb?.genres.slice(0, 3).join(', ')
		];
		return parts.filter(Boolean).join(' · ');
	}
</script>

<div class="pick">
	<button type="button" onclick={pick} disabled={films.length === 0}>
		{picked ? 'Pick another' : 'Pick one for me'}
	</button>
	{#if picked}
		{@const offers = offersOf(picked)}
		{@const streaming = providersOf(offers, STREAM_KINDS)}
		{@const poster = imageUrl(picked.tmdb?.posterPath ?? null, 'w185')}
		{@const href = webHref(picked.uri)}
		<div class="card" aria-live="polite">
			{#if poster}<img src={poster} alt="" width="92" height="138" />{/if}
			<div>
				<p class="title">{picked.name}</p>
				<p class="meta">{details(picked)}</p>
				<p class="meta">
					{streaming.length > 0
						? `Streaming on ${streaming.map((p) => p.name).join(', ')}`
						: 'Not streaming in your country'}
				</p>
				<p class="links">
					{#if href}<a {href} target="_blank" rel="noopener">On Letterboxd</a>{/if}
					{#if offers?.link}
						<a href={offers.link} target="_blank" rel="noopener">Where to watch</a>
					{/if}
				</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.pick {
		margin-bottom: 16px;
	}
	.card {
		display: flex;
		gap: 16px;
		margin-top: 12px;
		padding: 12px;
		border: 1px solid var(--border);
		background: var(--bg-secondary);
	}
	.card img {
		display: block;
		flex-shrink: 0;
		object-fit: cover;
	}
	.title {
		margin: 0 0 4px;
		font-size: var(--text-lg);
	}
	.meta {
		margin: 0 0 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.links {
		display: flex;
		gap: 16px;
		margin: 8px 0 0;
		font-size: var(--text-sm);
	}
	button:disabled {
		color: var(--fg-muted);
		cursor: default;
	}
</style>
