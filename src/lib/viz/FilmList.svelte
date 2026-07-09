<script lang="ts">
	import type { EnrichedFilm } from '$lib/types';

	let { title, films }: { title: string; films: EnrichedFilm[] } = $props();

	const sorted = $derived(
		[...films].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name))
	);
</script>

<div class="panel">
	<h4>{title} — {films.length} film{films.length === 1 ? '' : 's'}</h4>
	<ul>
		{#each sorted as film (film.uri)}
			<li>
				<a href={film.uri} target="_blank" rel="noopener">{film.name}</a>
				<span class="meta">{film.year ?? ''}</span>
				{#if film.rating !== null}<span class="value">★ {film.rating}</span>{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.panel {
		margin-top: 12px;
		padding: 12px;
		background: var(--bg-secondary);
		border-radius: 4px;
	}
	h4 {
		margin: 0 0 8px;
		font-size: 0.875rem;
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
		font-size: 0.875rem;
	}
	.meta {
		color: var(--fg-muted);
	}
	a {
		color: var(--accent);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a:hover {
		text-decoration: underline;
	}
	.value {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	@media (max-width: 640px) {
		ul {
			columns: 1;
		}
	}
</style>
