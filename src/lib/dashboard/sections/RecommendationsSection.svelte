<script lang="ts">
	import { imageUrl, letterboxdTmdbUrl } from '$lib/film/links';
	import Section from '../Section.svelte';
	import { getLibrary } from '$lib/library.svelte';
	import { isTmdbId, MAX_SEEDS, type Recommendation } from '$lib/types';
	import { fetchRecommendationsSettled } from '$lib/recommend/recommend';
	import { runGuard } from '$lib/recommend/runGuard';
	import { favoriteGenres, pickDiverseSeeds, pickGenreSeeds } from '$lib/recommend/seeds';

	const GENRE_ROWS = 3;
	const GENRE_ROW_SIZE = 10;

	const library = getLibrary();

	let general: Recommendation[] = $state([]);
	let genreRows: { genre: string; recommendations: Recommendation[] }[] = $state([]);

	let failed = $state(false);
	let attempt = $state(0);

	const guard = runGuard();

	$effect(() => {
		attempt;
		const films = library.films;
		const exclude = library.recommendExclude;
		const genres = favoriteGenres(films, GENRE_ROWS);
		const seedSets = [
			pickDiverseSeeds(films, MAX_SEEDS),
			...genres.map((genre) => pickGenreSeeds(films, genre))
		];
		void fetchRecommendationsSettled(
			seedSets,
			exclude,
			([main, ...perGenre], didFail) => {
				failed = didFail;
				general = main;
				const seen = new Set(main.map((r) => r.tmdbId));
				genreRows = genres.flatMap((genre, i) => {
					const fresh = perGenre[i].filter((r) => !seen.has(r.tmdbId)).slice(0, GENRE_ROW_SIZE);
					for (const rec of fresh) seen.add(rec.tmdbId);
					return fresh.length > 0 ? [{ genre, recommendations: fresh }] : [];
				});
			},
			guard.begin()
		);
	});
</script>

{#snippet posterGrid(recommendations: Recommendation[])}
	<ul>
		{#each recommendations as rec (rec.tmdbId)}
			{@const poster = imageUrl(rec.posterPath, 'w154')}
			<li>
				<a href={letterboxdTmdbUrl(rec.tmdbId)} target="_blank" rel="noopener">
					{#if poster}
						<img src={poster} alt="" loading="lazy" width="92" height="164" />
					{:else if rec.pending}
						<span class="placeholder pending" aria-hidden="true"></span>
					{:else}
						<span class="placeholder" aria-hidden="true"></span>
					{/if}
					<span class="title">{rec.title}</span>
					<span class="year" data-numeric>{rec.year ?? ''}</span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet watchlistToggle()}
	{#if library.watchlist.some((film) => film.tmdb && isTmdbId(film.tmdb.tmdbId))}
		<label class="toggle">
			<input type="checkbox" bind:checked={library.includeWatchlist} />
			Include films from my watchlist
		</label>
	{/if}
{/snippet}

{#if general.length > 0 || genreRows.length > 0 || failed}
	<Section id="recommendations" title="You might like" actions={watchlistToggle}>
		{#if failed && general.length === 0 && genreRows.length === 0}
			<p class="failed">
				Recommendations could not be loaded.
				<button
					type="button"
					onclick={() => {
						failed = false;
						attempt += 1;
					}}
				>
					Try again
				</button>
			</p>
		{/if}
		{#if general.length > 0}
			{@render posterGrid(general)}
		{/if}
		{#each genreRows as row (row.genre)}
			<h3>Because you love {row.genre}</h3>
			{@render posterGrid(row.recommendations)}
		{/each}
	</Section>
{/if}

<style>
	h3 {
		margin: 24px 0 12px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 16px;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-decoration: none;
		color: var(--fg);
	}
	a:hover .title {
		text-decoration: underline;
	}
	/*
	 * `height: auto` is what makes the ratio hold: the height attribute is a presentational hint,
	 * and a definite width and height together make the browser ignore aspect-ratio. Without it
	 * the box stayed a fixed 164px tall over a fluid width, so the shape drifted with the column
	 * and was furthest from 9/16 on narrow screens.
	 */
	img,
	.placeholder {
		width: 100%;
		height: auto;
		aspect-ratio: 9 / 16;
		object-fit: cover;
		background: var(--surface);
	}
	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-2xl);
	}
	.placeholder.pending {
		animation: poster-pulse 1.2s ease-in-out infinite;
	}
	@keyframes poster-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}
	.title {
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
	}
	.year {
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.failed {
		color: var(--fg-secondary);
	}
	.failed button {
		font: inherit;
		margin-left: 8px;
		padding: 2px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.failed button:hover {
		background: var(--surface);
	}
	.failed button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.toggle input {
		accent-color: var(--accent);
		margin: 0;
	}
</style>
