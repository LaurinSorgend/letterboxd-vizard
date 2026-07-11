<script lang="ts">
	import { imageUrl } from './images';
	import { fetchRecommendations, type Recommendation } from './recommend';
	import { favoriteGenres, pickDiverseSeeds, pickGenreSeeds, watchedTmdbIds } from './seeds';
	import type { EnrichedFilm, Seed } from '$lib/types';

	const GENRE_ROWS = 3;
	const GENRE_ROW_SIZE = 10;

	let {
		films,
		watchlistIds = [],
		includeWatchlist = $bindable(false)
	}: {
		films: EnrichedFilm[];
		watchlistIds?: number[];
		includeWatchlist?: boolean;
	} = $props();

	let general: Recommendation[] = $state([]);
	let genreRows: { genre: string; recommendations: Recommendation[] }[] = $state([]);

	$effect(() => {
		void load(films, includeWatchlist ? [] : watchlistIds);
	});

	async function load(current: EnrichedFilm[], watchlistExclude: number[]) {
		const exclude = [...watchedTmdbIds(current), ...watchlistExclude];
		const safeFetch = (seeds: Seed[]) => fetchRecommendations(seeds, exclude).catch(() => []);
		const genres = favoriteGenres(current, GENRE_ROWS);
		const [main, ...perGenre] = await Promise.all([
			safeFetch(pickDiverseSeeds(current, 25)),
			...genres.map((genre) => safeFetch(pickGenreSeeds(current, genre)))
		]);
		general = main;
		const seen = new Set(main.map((r) => r.tmdbId));
		genreRows = genres.flatMap((genre, i) => {
			const fresh = perGenre[i].filter((r) => !seen.has(r.tmdbId)).slice(0, GENRE_ROW_SIZE);
			for (const rec of fresh) seen.add(rec.tmdbId);
			return fresh.length > 0 ? [{ genre, recommendations: fresh }] : [];
		});
	}
</script>

{#snippet posterGrid(recommendations: Recommendation[])}
	<ul>
		{#each recommendations as rec (rec.tmdbId)}
			{@const poster = imageUrl(rec.posterPath, 'w154')}
			<li>
				<a href="https://letterboxd.com/tmdb/{rec.tmdbId}" target="_blank" rel="noopener">
					{#if poster}
						<img src={poster} alt="" loading="lazy" width="92" height="138" />
					{:else}
						<span class="placeholder" aria-hidden="true">🎬</span>
					{/if}
					<span class="title">{rec.title}</span>
					<span class="year">{rec.year ?? ''}</span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#if general.length > 0 || genreRows.length > 0}
	<section>
		<div class="heading">
			<h2>You might like</h2>
			{#if watchlistIds.length > 0}
				<label class="toggle">
					<input type="checkbox" bind:checked={includeWatchlist} />
					Include films from my watchlist
				</label>
			{/if}
		</div>
		<p class="note">Based on Trakt's related films for your highest-rated movies.</p>
		{#if general.length > 0}
			{@render posterGrid(general)}
		{/if}
		{#each genreRows as row (row.genre)}
			<h3>Because you love {row.genre}</h3>
			{@render posterGrid(row.recommendations)}
		{/each}
	</section>
{/if}

<style>
	.note {
		font-size: 0.875rem;
		color: var(--fg-muted);
		margin: 0 0 12px;
	}
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
	img,
	.placeholder {
		width: 100%;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		border-radius: 4px;
		background: var(--surface);
	}
	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
	}
	.title {
		font-size: 0.875rem;
		line-height: 1.25;
	}
	.year {
		font-size: 0.75rem;
		color: var(--fg-muted);
	}
	.heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px 16px;
		flex-wrap: wrap;
	}
	.heading h2 {
		margin: 0;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.875rem;
		color: var(--fg-secondary);
	}
	.toggle input {
		accent-color: var(--accent);
		margin: 0;
	}
</style>
