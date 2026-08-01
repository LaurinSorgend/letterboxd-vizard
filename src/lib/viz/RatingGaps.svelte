<script lang="ts">
	import { ratingGaps } from './stats';
	import { webHref } from './href';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const gaps = $derived(ratingGaps(films));
	const lists = $derived([
		{ title: 'You liked these more than TMDB', rows: gaps.over },
		{ title: 'TMDB liked these more than you', rows: gaps.under }
	]);
</script>

<div class="gaps">
	{#each lists as list (list.title)}
		<div>
			<h3>{list.title}</h3>
			<ul>
				{#each list.rows as row (row.film.uri)}
					<li>
						<a
							class="name"
							href={webHref(row.film.uri) ?? undefined}
							target="_blank"
							rel="noopener"
							title={row.film.name}
						>
							{row.film.name}
						</a>
						<span class="nums" data-numeric>
							you <strong>{row.yours}</strong> · TMDB <strong>{row.tmdb.toFixed(1)}</strong>
						</span>
					</li>
				{:else}
					<li class="empty">No rated films with a TMDB score yet.</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>

<style>
	.gaps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 24px;
	}
	h3 {
		margin: 0 0 8px;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--accent);
		text-decoration: none;
	}
	.name:hover {
		text-decoration: underline;
	}
	.nums {
		color: var(--fg-secondary);
		white-space: nowrap;
	}
	.empty {
		color: var(--fg-muted);
		border-bottom: none;
	}
</style>
