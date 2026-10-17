<script lang="ts">
	import { imageUrl } from '$lib/viz/images';
	import { webHref } from '$lib/viz/href';
	import { providersOf, STREAM_KINDS, type OffersOf } from './filter';
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

	/** Every poster is a request and a decode, so the wall opens with a readable slice of one. */
	const PAGE = 240;
	const LOGOS = 3;

	let expanded = $state(false);
	const shown = $derived(expanded ? films : films.slice(0, PAGE));

	function streamers(film: WatchlistFilm): Provider[] {
		const all = providersOf(offersOf(film), STREAM_KINDS);
		const picked = all.filter((p) => services.includes(p.id));
		return [...picked, ...all.filter((p) => !services.includes(p.id))];
	}

	function label(film: WatchlistFilm, on: Provider[]): string {
		const year = film.tmdb?.year ?? film.year;
		const where = on.length > 0 ? `, streaming on ${on.map((p) => p.name).join(', ')}` : '';
		return `${film.name}${year ? ` (${year})` : ''}${where}`;
	}
</script>

<ul class="wall">
	{#each shown as film (film.uri)}
		{@const href = webHref(film.uri)}
		{@const src = imageUrl(film.tmdb?.posterPath ?? null, 'w185')}
		{@const on = streamers(film)}
		<li>
			<svelte:element
				this={href ? 'a' : 'div'}
				href={href ?? undefined}
				target={href ? '_blank' : undefined}
				rel={href ? 'noopener' : undefined}
				class="tile"
				class:blank={!src}
				title={label(film, on)}
				aria-label={href ? label(film, on) : undefined}
			>
				{#if src}
					<img {src} alt="" loading="lazy" decoding="async" />
				{:else}
					<span>{film.name}</span>
				{/if}
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
			</svelte:element>
		</li>
	{/each}
</ul>

{#if films.length > PAGE}
	<button type="button" class="more" onclick={() => (expanded = !expanded)}>
		{expanded ? `Show the first ${PAGE}` : `Show all (${films.length})`}
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
	a.tile:hover {
		outline: 2px solid var(--accent);
	}
	a.tile:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
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
	.more {
		margin-top: 12px;
		padding: 4px 12px;
	}
</style>
