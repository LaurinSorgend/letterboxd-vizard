<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import FileDrop from '$lib/FileDrop.svelte';
	import WorldMap from '$lib/viz/WorldMap.svelte';
	import Columns from '$lib/viz/Columns.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import RatingGaps from '$lib/viz/RatingGaps.svelte';
	import StatTiles from '$lib/viz/StatTiles.svelte';
	import { aggregateCountries } from '$lib/viz/countries';
	import {
		byGenre,
		byLanguage,
		byPerson,
		ratingHistogram,
		releaseDecades,
		totalRuntimeMinutes,
		watchesPerYear
	} from '$lib/viz/stats';
	import { parseExport } from '$lib/ingest/parse';
	import { enrichFilms } from '$lib/ingest/enrich';
	import type { EnrichedFilm, LetterboxdData } from '$lib/types';

	type Phase = 'idle' | 'working' | 'ready';
	let phase: Phase = $state('idle');
	let data: LetterboxdData | null = $state(null);
	let films: EnrichedFilm[] = $state([]);
	let progress = $state({ done: 0, total: 0 });
	let errorMessage: string | null = $state(null);

	const unmatched = $derived(films.filter((f) => !f.tmdb));

	const tiles = $derived.by(() => {
		const ratings = films.map((f) => f.rating).filter((r): r is number => r !== null);
		const avg = ratings.length
			? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(2)
			: '—';
		const hours = Math.round(totalRuntimeMinutes(films) / 60);
		return [
			{ label: 'Films watched', value: String(films.length) },
			{ label: 'Hours watched', value: hours.toLocaleString('en') },
			{ label: 'Countries', value: String(aggregateCountries(films).size) },
			{ label: 'Your average rating', value: avg }
		];
	});

	onMount(async () => {
		if (dev && page.url.searchParams.has('demo')) {
			const response = await fetch('/demo-export.zip');
			if (response.ok) handleFile(new File([await response.blob()], 'demo.zip'));
		}
	});

	async function handleFile(file: File) {
		errorMessage = null;
		phase = 'working';
		try {
			data = parseExport(new Uint8Array(await file.arrayBuffer()));
			progress = { done: 0, total: data.films.length };
			films = await enrichFilms(data.films, (done, total) => (progress = { done, total }));
			phase = 'ready';
		} catch (cause) {
			errorMessage = cause instanceof Error ? cause.message : String(cause);
			phase = 'idle';
		}
	}
</script>

<svelte:head>
	<title>Letterboxd Vizard</title>
</svelte:head>

<main>
	<header>
		<h1>Letterboxd Vizard</h1>
		{#if data?.profile && phase === 'ready'}
			<p class="sub">
				{data.profile.givenName || data.profile.username} · {films.length} films watched
			</p>
		{/if}
	</header>

	{#if phase === 'idle'}
		{#if errorMessage}
			<p class="error" role="alert">
				{errorMessage} — make sure you drop the unmodified zip downloaded from Letterboxd.
			</p>
		{/if}
		<FileDrop onfile={handleFile} />
	{:else if phase === 'working'}
		<div class="progress" role="status">
			{#if progress.total === 0}
				<p>Reading your export…</p>
			{:else}
				<p>Looking up film data… {progress.done} / {progress.total}</p>
				<progress value={progress.done} max={progress.total}></progress>
				<p class="sub">First run fetches from TMDB; repeat visits are instant thanks to caching.</p>
			{/if}
		</div>
	{:else}
		<StatTiles {tiles} />

		<section>
			<h2>Your films around the world</h2>
			<WorldMap {films} />
		</section>

		<section>
			<h2>Rating habits</h2>
			<div class="pair">
				<div>
					<h3>How you rate</h3>
					<Columns data={ratingHistogram(films)} description="Number of films per rating step" />
				</div>
				<RatingGaps {films} />
			</div>
		</section>

		<section>
			<h2>Through the years</h2>
			<div class="pair">
				<div>
					<h3>Watches per year (diary)</h3>
					<Columns data={watchesPerYear(films)} description="Diary entries per year" />
				</div>
				<div>
					<h3>Films by release decade</h3>
					<Columns data={releaseDecades(films)} description="Films per release decade" />
				</div>
			</div>
		</section>

		<section>
			<h2>Genres &amp; languages</h2>
			<div class="pair">
				<div>
					<h3>Genres</h3>
					<RankedBars data={byGenre(films)} showAvg description="Films and average rating per genre" />
				</div>
				<div>
					<h3>Original language</h3>
					<RankedBars data={byLanguage(films)} showAvg description="Films and average rating per language" />
				</div>
			</div>
		</section>

		<section>
			<h2>People</h2>
			<div class="pair">
				<div>
					<h3>Most-watched directors</h3>
					<RankedBars data={byPerson(films, 'directors')} showAvg description="Films and average rating per director" />
				</div>
				<div>
					<h3>Most-watched actors</h3>
					<RankedBars data={byPerson(films, 'cast')} showAvg description="Films and average rating per actor" />
				</div>
			</div>
		</section>

		{#if unmatched.length > 0}
			<details class="unmatched">
				<summary>{unmatched.length} films could not be matched on TMDB</summary>
				<ul>
					{#each unmatched as film (film.uri)}
						<li>{film.name} ({film.year ?? 'unknown year'})</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</main>

<footer>
	<p>
		Film metadata from <a href="https://www.themoviedb.org">TMDB</a>. This product uses the TMDB
		API but is not endorsed or certified by TMDB.
	</p>
</footer>

<style>
	main {
		max-width: 1080px;
		margin: 0 auto;
		padding: 24px 16px;
	}
	header {
		margin-bottom: 24px;
	}
	h1 {
		margin: 0;
	}
	.sub {
		color: var(--fg-secondary);
		margin: 4px 0 0;
	}
	.error {
		padding: 8px 12px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--error) 12%, transparent);
		color: var(--error);
	}
	.progress {
		text-align: center;
		padding: 48px 0;
	}
	progress {
		width: min(400px, 100%);
		accent-color: var(--accent);
	}
	section {
		margin-bottom: 32px;
	}
	section:first-of-type {
		margin-top: 24px;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
		align-items: start;
	}
	@media (max-width: 900px) {
		.pair {
			grid-template-columns: 1fr;
		}
	}
	.unmatched summary {
		cursor: pointer;
		color: var(--fg-secondary);
	}
	.unmatched ul {
		color: var(--fg-secondary);
		columns: 2;
	}
	footer {
		max-width: 1080px;
		margin: 0 auto;
		padding: 16px;
		border-top: 1px solid var(--border);
		font-size: 0.75rem;
		color: var(--fg-muted);
	}
	@media (max-width: 640px) {
		.unmatched ul {
			columns: 1;
		}
	}
</style>
