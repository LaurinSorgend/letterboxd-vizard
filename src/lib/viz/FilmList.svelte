<script lang="ts" module>
	import type { Film } from '$lib/types';

	/** Highest rated first, unrated last, then by name: how every film list reads. */
	export const byRatingThenName = (a: Film, b: Film): number =>
		(b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name);
</script>

<script lang="ts">
	import { noun } from '$lib/format';
	import type { EnrichedFilm } from '$lib/types';
	import FilmLink from './chart/FilmLink.svelte';

	let { title, films }: { title: string; films: EnrichedFilm[] } = $props();

	const sorted = $derived([...films].sort(byRatingThenName));
</script>

<div class="panel">
	<h3>{title}: {films.length} {noun(films.length, 'film')}</h3>
	<ul>
		{#each sorted as film (film.uri)}
			<li>
				<FilmLink {film} class="name" />
				<span class="meta" data-numeric>{film.year ?? ''}</span>
				{#if film.rating !== null}<span class="value" data-numeric>★ {film.rating}</span>{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.panel {
		margin-top: 12px;
		padding: 12px;
		background: var(--bg-secondary);
	}
	h3 {
		margin: 0 0 8px;
		font-size: var(--text-base);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		columns: 2;
		column-gap: 24px;
	}
	li {
		display: flex;
		gap: 8px;
		padding: 2px 0;
		break-inside: avoid;
		font-size: var(--text-sm);
	}
	.meta {
		color: var(--fg-muted);
	}
	li :global(.name) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	li :global(a.name) {
		color: var(--accent);
		text-decoration: none;
	}
	li :global(a.name:hover) {
		text-decoration: underline;
	}
	.value {
		margin-left: auto;
		white-space: nowrap;
	}
	@media (max-width: 640px) {
		ul {
			columns: 1;
		}
	}
</style>
