<script lang="ts">
	import { imageUrl, webHref } from '$lib/film/links';
	import { formatShort } from '$lib/format';
	import type { RecentWatch } from './stats';

	let { watches }: { watches: RecentWatch[] } = $props();
</script>

<ol class="row">
	{#each watches as { film, date, rating } (film.uri)}
		{@const href = webHref(film.uri)}
		{@const src = imageUrl(film.tmdb?.posterPath ?? null, 'w185')}
		<li>
			<svelte:element
				this={href ? 'a' : 'div'}
				href={href ?? undefined}
				target={href ? '_blank' : undefined}
				rel={href ? 'noopener' : undefined}
				class="tile"
			>
				<span class="poster">
					{#if src}
						<img {src} alt="" loading="lazy" decoding="async" />
					{/if}
				</span>
				<span class="name" title={film.name}>{film.name}</span>
				<span class="meta" data-numeric>{formatShort(date)}</span>
				{#if rating !== null}
					<span class="meta" data-numeric>★ {rating}</span>
				{/if}
			</svelte:element>
		</li>
	{/each}
</ol>

<style>
	.row {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(96px, 1fr);
		gap: 8px;
		overflow-x: auto;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		color: var(--fg);
		text-decoration: none;
	}
	.poster {
		display: block;
		aspect-ratio: 2 / 3;
		margin-bottom: 4px;
		background: var(--surface);
	}
	.poster img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.name {
		overflow: hidden;
		font-size: var(--text-sm);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		font-size: var(--text-xs);
		color: var(--fg-secondary);
	}
	a.tile:hover .name {
		color: var(--accent);
		text-decoration: underline;
	}
	a.tile:hover .poster {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	a.tile:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}
</style>
