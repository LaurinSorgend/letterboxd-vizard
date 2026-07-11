<script lang="ts">
	import type { CountryStat } from './countries';
	import { imageUrl } from './images';
	import { fetchRecommendations, type Recommendation } from './recommend';
	import { pickCountrySeeds } from './seeds';

	let { stat, exclude }: { stat: CountryStat; exclude: number[] } = $props();

	let status: 'loading' | 'none' | 'ready' = $state('loading');
	let recs: Recommendation[] = $state([]);

	$effect(() => {
		void load(stat, exclude);
	});

	async function load(current: CountryStat, excludeIds: number[]) {
		status = 'loading';
		recs = [];
		try {
			const results = await fetchRecommendations(pickCountrySeeds(current.films, 8), excludeIds);
			recs = results.filter((r) => r.countries.includes(current.code)).slice(0, 3);
			status = recs.length > 0 ? 'ready' : 'none';
		} catch {
			status = 'none';
		}
	}
</script>

{#if status === 'loading'}
	<p class="panel note" role="status">Looking for a pick from {stat.name}…</p>
{:else if status === 'ready'}
	<div class="panel recs">
		<span class="note">You might like:</span>
		{#each recs as rec (rec.tmdbId)}
			{@const poster = imageUrl(rec.posterPath, 'w92')}
			<a href="https://letterboxd.com/tmdb/{rec.tmdbId}" target="_blank" rel="noopener">
				{#if poster}
					<img src={poster} alt="" width="31" height="46" loading="lazy" />
				{/if}
				<span class="title" title={rec.title}>{rec.title}</span>
				<span class="year">{rec.year ?? ''}</span>
			</a>
		{/each}
	</div>
{/if}

<style>
	.panel {
		margin-top: 12px;
		padding: 12px;
		background: var(--bg-secondary);
		border-radius: 4px;
	}
	.note {
		font-size: 0.875rem;
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
		font-size: 0.875rem;
	}
	a:hover .title {
		text-decoration: underline;
	}
	img {
		border-radius: 2px;
		background: var(--surface);
	}
	.year {
		color: var(--fg-muted);
	}
</style>
