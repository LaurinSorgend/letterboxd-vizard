<script lang="ts">
	import { imageUrl } from './images';
	import { webHref } from './href';
	import { extractPalette, type Swatch } from './colors';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	type Sort = 'rating' | 'watched' | 'year' | 'colour';
	/** Every poster is a request and a decode, so the wall opens with a readable slice of one. */
	const PAGE = 300;

	let sort: Sort = $state('rating');
	let expanded = $state(false);
	let palette: Map<string, Swatch> = $state(new Map());
	let reading = $state(false);
	let progress = $state(0);
	let refused = $state(false);

	function poster(film: EnrichedFilm): string | null {
		return imageUrl(film.tmdb?.posterPath ?? null, 'w154');
	}

	function lastWatch(film: EnrichedFilm): string {
		return film.watchedDates.length > 0 ? film.watchedDates[film.watchedDates.length - 1] : '';
	}

	/** Greyscale posters have no meaningful hue, so they gather at the end rather than at red. */
	function colourKey(film: EnrichedFilm): [number, number] {
		const url = poster(film);
		const swatch = url ? palette.get(url) : undefined;
		if (!swatch || swatch.sat === 0) return [1, swatch?.light ?? 0];
		return [0, swatch.hue];
	}

	function compare(a: EnrichedFilm, b: EnrichedFilm): number {
		if (sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
		if (sort === 'watched') return lastWatch(b).localeCompare(lastWatch(a));
		if (sort === 'year') return (b.tmdb?.year ?? b.year ?? 0) - (a.tmdb?.year ?? a.year ?? 0);
		const [groupA, keyA] = colourKey(a);
		const [groupB, keyB] = colourKey(b);
		return groupA - groupB || keyA - keyB;
	}

	const ordered = $derived(
		[...films].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name))
	);
	const shown = $derived(expanded ? ordered : ordered.slice(0, PAGE));
	const unread = $derived(
		[...new Set(shown.map(poster).filter((url): url is string => url !== null))].filter(
			(url) => !palette.has(url)
		)
	);

	async function readColours() {
		reading = true;
		progress = 0;
		const found = await extractPalette(unread, (done) => (progress = done));
		reading = false;
		if (!found) {
			refused = true;
			return;
		}
		palette = new Map([...palette, ...found]);
		sort = 'colour';
	}

	function label(film: EnrichedFilm): string {
		const year = film.tmdb?.year ?? film.year;
		const rating = film.rating !== null ? ` — ★ ${film.rating}` : '';
		return `${film.name}${year ? ` (${year})` : ''}${rating}`;
	}
</script>

<div class="controls">
	<label>
		Order
		<select bind:value={sort}>
			<option value="rating">Your rating</option>
			<option value="watched">Recently watched</option>
			<option value="year">Release year</option>
			<option value="colour" disabled={palette.size === 0}>Colour spectrum</option>
		</select>
	</label>

	{#if !refused && unread.length > 0}
		<button type="button" onclick={readColours} disabled={reading}>
			{reading ? 'Reading colours…' : 'Sort by colour'}
		</button>
	{/if}
	{#if reading}
		<progress value={progress} max={unread.length} aria-label="Reading poster colours"></progress>
	{/if}
</div>

{#if refused}
	<p class="note">
		Colour sorting has to read the poster images pixel by pixel, and this browser will not allow
		that for images served from TMDB. The other orderings are unaffected.
	</p>
{/if}

<ul class="wall">
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
			</svelte:element>
		</li>
	{/each}
</ul>

{#if ordered.length > PAGE}
	<button type="button" class="more" onclick={() => (expanded = !expanded)}>
		{expanded ? `Show the first ${PAGE}` : `Show all (${ordered.length})`}
	</button>
{/if}

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	select,
	button {
		font: inherit;
		font-size: var(--text-sm);
		padding: 4px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}
	button {
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: var(--surface);
	}
	button:disabled {
		color: var(--fg-muted);
		cursor: default;
	}
	progress {
		width: 160px;
		accent-color: var(--accent);
	}

	.wall {
		display: grid;
		/* A 2px gutter of page background, so neighbouring posters never bleed into one another. */
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tile {
		display: block;
		/* Posters are 2:3; the ratio lives here and never on the img, which would fight it. */
		aspect-ratio: 2 / 3;
		background: var(--surface);
	}
	.tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.tile.blank {
		display: flex;
		align-items: center;
		padding: 4px;
		overflow: hidden;
		border: 1px solid var(--border);
		font-size: var(--text-2xs);
		color: var(--fg-muted);
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
	.note {
		margin: 0 0 12px;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
</style>
