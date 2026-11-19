<script lang="ts">
	import { imageUrl, letterboxdTmdbUrl } from '$lib/film/links';
	import type { EnrichedFilm, Recommendation } from '$lib/types';
	import { fetchRecommendationsSettled } from './recommend';
	import { runGuard } from './runGuard';
	import { pickCountrySeeds } from './seeds';

	const PICKS = 3;

	let {
		code,
		name,
		films,
		exclude
	}: {
		code: string;
		name: string;
		films: EnrichedFilm[];
		/** TMDB ids the picks must leave out. */
		exclude: number[];
	} = $props();

	let status: 'loading' | 'none' | 'ready' = $state('loading');
	let recs: Recommendation[] = $state([]);

	const guard = runGuard();

	$effect(() => {
		const country = code;
		const seeds = pickCountrySeeds(films, 8);
		status = 'loading';
		recs = [];
		void fetchRecommendationsSettled(
			[seeds],
			exclude,
			([results]) => {
				// A pending film's countries are not known yet, so it can't count as a pick until it settles.
				recs = results.filter((r) => !r.pending && r.countries.includes(country)).slice(0, PICKS);
				const waiting = results.some((r) => r.pending);
				status = recs.length > 0 ? 'ready' : waiting ? 'loading' : 'none';
			},
			guard.begin()
		);
	});
</script>

{#if status === 'loading'}
	<p class="panel note" role="status">Looking for a pick from {name}…</p>
{:else if status === 'ready'}
	<div class="panel recs">
		<span class="note">You might like:</span>
		{#each recs as rec (rec.tmdbId)}
			{@const poster = imageUrl(rec.posterPath, 'w92')}
			<a href={letterboxdTmdbUrl(rec.tmdbId)} target="_blank" rel="noopener">
				{#if poster}
					<img src={poster} alt="" width="31" height="46" loading="lazy" />
				{/if}
				<span class="title" title={rec.title}>{rec.title}</span>
				<span class="year" data-numeric>{rec.year ?? ''}</span>
			</a>
		{/each}
	</div>
{/if}

<style>
	.panel {
		margin-top: 12px;
		padding: 12px;
		background: var(--bg-secondary);
	}
	.note {
		font-size: var(--text-sm);
		color: var(--fg-muted);
		margin: 0;
	}
	.recs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}
	a {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--accent);
		text-decoration: none;
		font-size: var(--text-sm);
	}
	a:hover .title {
		text-decoration: underline;
	}
	img {
		background: var(--surface);
	}
	.year {
		color: var(--fg-muted);
	}
</style>
