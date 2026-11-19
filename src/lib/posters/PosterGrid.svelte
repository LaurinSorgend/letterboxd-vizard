<script lang="ts" generics="T extends { uri: string; name: string }">
	import type { Snippet } from 'svelte';
	import { webHref } from '$lib/film/links';

	let {
		films,
		page,
		expanded = $bindable(false),
		dense = false,
		poster,
		label,
		overlay
	}: {
		films: T[];
		/** Every poster is a request and a decode, so the wall opens with a readable slice of one. */
		page: number;
		/** Whether the whole wall is shown rather than the first `page`. */
		expanded?: boolean;
		/** Small tiles on a hairline gutter, for a wall of the whole library. */
		dense?: boolean;
		poster: (film: T) => string | null;
		/** Hover text and accessible name of a tile. */
		label: (film: T) => string;
		/** Drawn over a tile, e.g. streaming logos. */
		overlay?: Snippet<[T]>;
	} = $props();

	const shown = $derived(expanded ? films : films.slice(0, page));
</script>

<ul class="wall" class:dense>
	{#each shown as film (film.uri)}
		{@const href = webHref(film.uri)}
		{@const src = poster(film)}
		<li>
			<svelte:element
				this={href ? 'a' : 'div'}
				href={href ?? undefined}
				target={href ? '_blank' : undefined}
				rel={href ? 'noopener' : undefined}
				class="tile"
				class:blank={!src}
				title={label(film)}
				aria-label={href ? label(film) : undefined}
			>
				{#if src}
					<img {src} alt="" loading="lazy" decoding="async" />
				{:else}
					<span>{film.name}</span>
				{/if}
				{@render overlay?.(film)}
			</svelte:element>
		</li>
	{/each}
</ul>

{#if films.length > page}
	<button type="button" class="more" onclick={() => (expanded = !expanded)}>
		{expanded ? `Show the first ${page}` : `Show all (${films.length})`}
	</button>
{/if}

<style>
	.wall {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
		gap: 8px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	@media (max-width: 640px) {
		.wall {
			grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
			gap: 4px;
		}
	}
	/* A 2px gutter of page background, so neighbouring posters never bleed into one another. */
	.wall.dense {
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
		gap: 2px;
	}
	.tile {
		position: relative;
		display: block;
		/* Posters are 2:3; the ratio lives here and never on the img, which would fight it. */
		aspect-ratio: 2 / 3;
		background: var(--surface);
	}
	.tile > img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.tile.blank {
		display: flex;
		align-items: center;
		padding: 6px;
		overflow: hidden;
		border: 1px solid var(--border);
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.dense .tile.blank {
		padding: 4px;
	}
	a.tile:hover {
		outline: 2px solid var(--accent);
	}
	a.tile:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.more {
		margin-top: 12px;
		padding: 4px 12px;
		cursor: pointer;
	}
</style>
