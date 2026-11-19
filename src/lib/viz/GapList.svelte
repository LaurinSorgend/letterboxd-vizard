<script lang="ts" generics="Row extends { film: EnrichedFilm }">
	import type { Snippet } from 'svelte';
	import FilmLink from './chart/FilmLink.svelte';
	import type { EnrichedFilm } from '$lib/types';

	let {
		lists,
		empty,
		nums
	}: {
		/** Side-by-side lists, typically the films you rate above a source and those it rates above you. */
		lists: { title: string; rows: Row[] }[];
		empty: string;
		/** The figures at the end of each row. */
		nums: Snippet<[Row]>;
	} = $props();
</script>

<div class="gaps">
	{#each lists as list (list.title)}
		<div>
			<h3>{list.title}</h3>
			<ul>
				{#each list.rows as row (row.film.uri)}
					<li>
						<FilmLink film={row.film} class="name" />
						<span class="nums" data-numeric>{@render nums(row)}</span>
					</li>
				{:else}
					<li class="empty">{empty}</li>
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
	.gaps :global(.name) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--accent);
		text-decoration: none;
	}
	.gaps :global(.name:hover) {
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
