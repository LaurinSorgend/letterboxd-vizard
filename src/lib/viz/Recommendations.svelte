<script lang="ts">
	import { imageUrl } from './images';
	import { fetchRecommendations, type Recommendation } from './recommend';
	import { favoriteGenres, pickDiverseSeeds, pickGenreSeeds, watchedTmdbIds } from './seeds';
	import { runGuard } from './runGuard';
	import type { EnrichedFilm, Seed } from '$lib/types';

	const GENRE_ROWS = 3;
	const GENRE_ROW_SIZE = 10;
	// Growing waits between retries: each request warms the cache, so the next resolves more posters.
	const RETRY_DELAYS_MS = [1500, 3500, 7000];

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

	const guard = runGuard();

	$effect(() => {
		void load(films, includeWatchlist ? [] : watchlistIds);
	});

	async function load(current: EnrichedFilm[], watchlistExclude: number[]) {
		const isCurrent = guard.begin();
		const exclude = [...watchedTmdbIds(current), ...watchlistExclude];
		const safeFetch = (seeds: Seed[]) => fetchRecommendations(seeds, exclude).catch(() => []);
		const genres = favoriteGenres(current, GENRE_ROWS);
		const seedSets = [
			pickDiverseSeeds(current, 25),
			...genres.map((genre) => pickGenreSeeds(current, genre))
		];
		const [main, ...perGenre] = await Promise.all(seedSets.map(safeFetch));
		if (!isCurrent()) return; // a newer load started while we awaited; don't overwrite it
		general = main;
		const seen = new Set(main.map((r) => r.tmdbId));
		genreRows = genres.flatMap((genre, i) => {
			const fresh = perGenre[i].filter((r) => !seen.has(r.tmdbId)).slice(0, GENRE_ROW_SIZE);
			for (const rec of fresh) seen.add(rec.tmdbId);
			return fresh.length > 0 ? [{ genre, recommendations: fresh }] : [];
		});
		void fillPending(seedSets, safeFetch, isCurrent);
	}

	function hasPending(): boolean {
		return (
			general.some((r) => r.pending) ||
			genreRows.some((row) => row.recommendations.some((r) => r.pending))
		);
	}

	/** Re-requests while posters are still pending, folding each resolved record in by tmdbId. */
	async function fillPending(
		seedSets: Seed[][],
		safeFetch: (seeds: Seed[]) => Promise<Recommendation[]>,
		isCurrent: () => boolean
	) {
		for (const wait of RETRY_DELAYS_MS) {
			if (!isCurrent() || !hasPending()) return;
			await new Promise((resolve) => setTimeout(resolve, wait));
			if (!isCurrent()) return;
			const fresh = (await Promise.all(seedSets.map(safeFetch))).flat();
			if (!isCurrent()) return;
			const resolved = new Map(fresh.filter((r) => !r.pending).map((r) => [r.tmdbId, r]));
			const fill = (r: Recommendation) => (r.pending ? (resolved.get(r.tmdbId) ?? r) : r);
			general = general.map(fill);
			genreRows = genreRows.map((row) => ({
				genre: row.genre,
				recommendations: row.recommendations.map(fill)
			}));
		}
		// Retries spent — settle any stragglers to the plain placeholder rather than pulse forever.
		if (!isCurrent() || !hasPending()) return;
		const settle = (r: Recommendation) => (r.pending ? { ...r, pending: false } : r);
		general = general.map(settle);
		genreRows = genreRows.map((row) => ({
			genre: row.genre,
			recommendations: row.recommendations.map(settle)
		}));
	}
</script>

{#snippet posterGrid(recommendations: Recommendation[])}
	<ul>
		{#each recommendations as rec (rec.tmdbId)}
			{@const poster = imageUrl(rec.posterPath, 'w154')}
			<li>
				<a href="https://letterboxd.com/tmdb/{rec.tmdbId}" target="_blank" rel="noopener">
					{#if poster}
						<img src={poster} alt="" loading="lazy" width="92" height="164" />
					{:else if rec.pending}
						<span class="placeholder pending" aria-hidden="true"></span>
					{:else}
						<span class="placeholder" aria-hidden="true">🎬</span>
					{/if}
					<span class="title">{rec.title}</span>
					<span class="year" data-numeric>{rec.year ?? ''}</span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#if general.length > 0 || genreRows.length > 0}
	<section id="recommendations">
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
		font-size: var(--text-sm);
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
	@media (prefers-reduced-motion: reduce) {
		.placeholder.pending {
			animation: none;
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
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.toggle input {
		accent-color: var(--accent);
		margin: 0;
	}
</style>
