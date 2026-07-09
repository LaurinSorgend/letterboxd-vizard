<script lang="ts">
	import type { TmdbMovie } from '$lib/types';
	import type { CountryStat } from './countries';
	import { pickCountrySeeds } from './seeds';

	let { stat, exclude }: { stat: CountryStat; exclude: number[] } = $props();

	interface Rec {
		tmdbId: number;
		title: string;
		year: number | null;
		poster: string | null;
	}

	let status: 'loading' | 'none' | 'ready' = $state('loading');
	let recs: Rec[] = $state([]);
	let requestId = 0;

	$effect(() => {
		void load(stat);
	});

	async function load(current: CountryStat) {
		const id = ++requestId;
		status = 'loading';
		recs = [];
		const seeds = pickCountrySeeds(current.films, 8);
		if (seeds.length === 0) {
			if (id === requestId) status = 'none';
			return;
		}
		try {
			const response = await fetch('/api/recommend', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ seeds, exclude })
			});
			if (!response.ok) throw new Error(String(response.status));
			const { available, results } = (await response.json()) as {
				available: boolean;
				results: { tmdbId: number; title: string; year: number | null }[];
			};
			if (!available || results.length === 0) throw new Error('empty');

			const enrich = await fetch('/api/enrich', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items: results.map((r) => ({ name: r.title, year: r.year })) })
			});
			const movies = enrich.ok
				? ((await enrich.json()) as { results: (TmdbMovie | null)[] }).results
				: [];

			const matches: Rec[] = [];
			results.forEach((r, i) => {
				const movie = movies[i];
				if (!movie || movie.mediaType !== 'movie' || movie.tmdbId !== r.tmdbId) return;
				if (!movie.countries.includes(current.code) && !movie.originCountries.includes(current.code))
					return;
				matches.push({
					tmdbId: r.tmdbId,
					title: r.title,
					year: r.year,
					poster: movie.posterPath ? `https://image.tmdb.org/t/p/w92${movie.posterPath}` : null
				});
			});
			if (id !== requestId) return;
			recs = matches.slice(0, 3);
			status = recs.length > 0 ? 'ready' : 'none';
		} catch {
			if (id === requestId) status = 'none';
		}
	}
</script>

{#if status === 'loading'}
	<p class="note" role="status">Looking for a pick from {stat.name}…</p>
{:else if status === 'ready'}
	<div class="recs">
		<span class="note">You might like:</span>
		{#each recs as rec (rec.tmdbId)}
			<a href="https://letterboxd.com/tmdb/{rec.tmdbId}" target="_blank" rel="noopener">
				{#if rec.poster}
					<img src={rec.poster} alt="" width="31" height="46" loading="lazy" />
				{/if}
				<span class="title" title={rec.title}>{rec.title}</span>
				<span class="year">{rec.year ?? ''}</span>
			</a>
		{/each}
	</div>
{/if}

<style>
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
		margin-bottom: 8px;
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
