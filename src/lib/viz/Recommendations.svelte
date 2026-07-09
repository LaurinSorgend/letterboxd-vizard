<script lang="ts">
	import type { EnrichedFilm, TmdbMovie } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	interface Recommendation {
		tmdbId: number;
		title: string;
		year: number | null;
		poster: string | null;
	}

	let status: 'loading' | 'hidden' | 'ready' = $state('loading');
	let recommendations: Recommendation[] = $state([]);

	$effect(() => {
		void load(films);
	});

	async function load(current: EnrichedFilm[]) {
		const watched = current.filter((f) => f.tmdb && f.tmdb.tmdbId > 0);
		const seeds = watched
			.filter((f) => f.rating !== null && f.rating >= 3.5 && f.tmdb?.mediaType === 'movie')
			.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
			.slice(0, 25)
			.map((f) => ({ tmdbId: f.tmdb!.tmdbId, rating: f.rating! }));
		if (seeds.length === 0) {
			status = 'hidden';
			return;
		}

		try {
			const response = await fetch('/api/recommend', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ seeds, exclude: watched.map((f) => f.tmdb!.tmdbId) })
			});
			if (!response.ok) throw new Error(String(response.status));
			const { available, results } = (await response.json()) as {
				available: boolean;
				results: { tmdbId: number; title: string; year: number | null }[];
			};
			if (!available || results.length === 0) {
				status = 'hidden';
				return;
			}

			const enrich = await fetch('/api/enrich', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items: results.map((r) => ({ name: r.title, year: r.year })) })
			});
			const posters = enrich.ok
				? ((await enrich.json()) as { results: (TmdbMovie | null)[] }).results
				: results.map(() => null);

			recommendations = results.map((r, i) => ({
				...r,
				poster: posters[i]?.posterPath
					? `https://image.tmdb.org/t/p/w154${posters[i].posterPath}`
					: null
			}));
			status = 'ready';
		} catch {
			status = 'hidden';
		}
	}
</script>

{#if status === 'ready'}
	<section>
		<h2>You might like</h2>
		<p class="note">Based on Trakt's related films for your highest-rated movies.</p>
		<ul>
			{#each recommendations as rec (rec.tmdbId)}
				<li>
					<a href="https://letterboxd.com/tmdb/{rec.tmdbId}" target="_blank" rel="noopener">
						{#if rec.poster}
							<img src={rec.poster} alt="" loading="lazy" width="92" height="138" />
						{:else}
							<span class="placeholder" aria-hidden="true">🎬</span>
						{/if}
						<span class="title">{rec.title}</span>
						<span class="year">{rec.year ?? ''}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.note {
		font-size: 0.875rem;
		color: var(--fg-muted);
		margin: 0 0 12px;
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
</style>
