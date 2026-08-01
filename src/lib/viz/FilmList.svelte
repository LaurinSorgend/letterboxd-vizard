<script lang="ts">
	import type { EnrichedFilm } from '$lib/types';
	import { webHref } from './href';

	let { title, films }: { title: string; films: EnrichedFilm[] } = $props();

	const sorted = $derived(
		[...films].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name))
	);
</script>

<div class="panel">
	<h3>{title}: {films.length} film{films.length === 1 ? '' : 's'}</h3>
	<ul>
		{#each sorted as film (film.uri)}
			<li>
				{#if webHref(film.uri)}
					<a href={webHref(film.uri)} target="_blank" rel="noopener" title={film.name}
						>{film.name}</a
					>
				{:else}
					<span class="name" title={film.name}>{film.name}</span>
				{/if}
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
	a,
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	a {
		color: var(--accent);
		text-decoration: none;
	}
	a:hover {
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
