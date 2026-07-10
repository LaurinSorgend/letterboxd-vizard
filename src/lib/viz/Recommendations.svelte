<script lang="ts">
	import { imageUrl } from './images';
	import { fetchRecommendations, type Recommendation } from './recommend';
	import { pickDiverseSeeds, watchedTmdbIds } from './seeds';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	let recommendations: Recommendation[] = $state([]);

	$effect(() => {
		void load(films);
	});

	async function load(current: EnrichedFilm[]) {
		try {
			recommendations = await fetchRecommendations(pickDiverseSeeds(current, 25), watchedTmdbIds(current));
		} catch {
			recommendations = [];
		}
	}
</script>

{#if recommendations.length > 0}
	<section>
		<h2>You might like</h2>
		<p class="note">Based on Trakt's related films for your highest-rated movies.</p>
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
