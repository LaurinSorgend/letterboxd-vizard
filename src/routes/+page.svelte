<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import FileDrop from '$lib/FileDrop.svelte';
	import RememberToggle from '$lib/RememberToggle.svelte';
	import ThemeSwitch from '$lib/ThemeSwitch.svelte';
	import WorldMap from '$lib/viz/WorldMap.svelte';
	import Columns from '$lib/viz/Columns.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import RatingGaps from '$lib/viz/RatingGaps.svelte';
	import Recommendations from '$lib/viz/Recommendations.svelte';
	import StatTiles from '$lib/viz/StatTiles.svelte';
	import Heatmap from '$lib/viz/Heatmap.svelte';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import { buildDailyHeatmap, buildWeeklyHeatmap, type HeatMetric } from '$lib/viz/heatmap';
	import { effectiveCountries } from '$lib/viz/countries';
	import {
		avgRating,
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
	import { watchedTmdbIds } from '$lib/viz/seeds';
	import { clearSnapshot, loadSnapshot, saveSnapshot } from '$lib/store';
	import type { EnrichedFilm, LetterboxdData } from '$lib/types';

	type Phase = 'idle' | 'working' | 'ready';
	let phase: Phase = $state('idle');
	let data: LetterboxdData | null = $state(null);
	let films: EnrichedFilm[] = $state([]);
	let progress = $state({ done: 0, total: 0 });
	let errorMessage: string | null = $state(null);
	let watchlistIds: number[] = $state([]);
	let includeWatchlist = $state(false);
	let remember = $state(false);
	let saveError: string | null = $state(null);

	const unmatched = $derived(films.filter((f) => !f.tmdb));
	const watchlistExclude = $derived(includeWatchlist ? [] : watchlistIds);

	const initialMetric = page.url.searchParams.get('metric') === 'rating' ? 'rating' : 'count';
	const presetCountry = page.url.searchParams.get('country');

	const currentYear = new Date().getFullYear();
	const dailyHeatmap = $derived(buildDailyHeatmap(films, currentYear));
	const weeklyHeatmap = $derived(buildWeeklyHeatmap(films));
	let heatMetric: HeatMetric = $state('watchtime');

	const tiles = $derived.by(() => {
		const avg = avgRating(films);
		const hours = Math.round(totalRuntimeMinutes(films) / 60);
		const countries = new Set(films.flatMap((f) => (f.tmdb ? effectiveCountries(f.tmdb) : [])));
		return [
			{ label: 'Films watched', value: String(films.length) },
			{ label: 'Hours watched', value: hours.toLocaleString('en') },
			{ label: 'Countries', value: String(countries.size) },
			{ label: 'Your average rating', value: avg !== null ? avg.toFixed(2) : '—' }
		];
	});

	onMount(async () => {
		if (dev && page.url.searchParams.has('demo')) {
			const response = await fetch('/demo-export.zip');
			if (response.ok) handleFile(new File([await response.blob()], 'demo.zip'));
			return;
		}
		const snapshot = loadSnapshot();
		if (snapshot) {
			films = snapshot.films;
			watchlistIds = snapshot.watchlistIds;
			data = { films: snapshot.films, watchlist: [], profile: snapshot.profile };
			remember = true;
			phase = 'ready';
		}
	});

	function persist() {
		if (saveSnapshot({ films, watchlistIds, profile: data?.profile ?? null })) {
			saveError = null;
		} else {
			remember = false;
			saveError =
				'Could not save — your library is too large for this browser. Data stays for this visit only.';
		}
	}

	function toggleRemember(on: boolean) {
		remember = on;
		if (on) persist();
		else {
			clearSnapshot();
			saveError = null;
		}
	}

	async function handleFile(file: File) {
		errorMessage = null;
		phase = 'working';
		try {
			const parsed = parseExport(new Uint8Array(await file.arrayBuffer()));
			data = parsed;
			const total = parsed.films.length + parsed.watchlist.length;
			const done = { films: 0, watchlist: 0 };
			const report = () => (progress = { done: done.films + done.watchlist, total });
			report();
			const [watched, watchlist] = await Promise.all([
				enrichFilms(parsed.films, (n) => ((done.films = n), report())),
				enrichFilms(parsed.watchlist, (n) => ((done.watchlist = n), report())).catch(() => [])
			]);
			films = watched;
			watchlistIds = watchedTmdbIds(watchlist);
			phase = 'ready';
			if (remember) persist();
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
		<div>
			<h1>Letterboxd Vizard</h1>
			{#if data?.profile && phase === 'ready'}
				<p class="sub">
					{data.profile.givenName || data.profile.username} · {films.length} films watched
				</p>
			{/if}
		</div>
		<ThemeSwitch />
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
		<RememberToggle checked={remember} error={saveError} onchange={toggleRemember} />

		<StatTiles {tiles} />

		<section>
			<h2>Your films around the world</h2>
			<WorldMap {films} {initialMetric} {presetCountry} {watchlistExclude} />
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
			<h2>When you watch</h2>
			<MetricToggle
				name="heat-metric"
				label="Heatmap metric"
				options={[
					{ value: 'watchtime', label: 'Watchtime' },
					{ value: 'rating', label: 'Average rating' }
				]}
				bind:value={heatMetric}
			/>
			<h3>This year, day by day</h3>
			<Heatmap grid={dailyHeatmap} metric={heatMetric} />
			<h3 class="spaced">Every week, year over year</h3>
			<Heatmap grid={weeklyHeatmap} metric={heatMetric} />
		</section>

		<section>
			<h2>Genres &amp; languages</h2>
			<div class="pair">
				<div>
					<h3>Genres</h3>
					<RankedBars
						data={byGenre(films)}
						showAvg
						description="Films and average rating per genre"
					/>
				</div>
				<div>
					<h3>Original language</h3>
					<RankedBars
						data={byLanguage(films)}
						showAvg
						description="Films and average rating per language"
					/>
				</div>
			</div>
		</section>

		<section>
			<h2>People</h2>
			<div class="pair">
				<div>
					<h3>Most-watched directors</h3>
					<RankedBars
						data={byPerson(films, 'directors')}
						showAvg
						description="Films and average rating per director"
					/>
				</div>
				<div>
					<h3>Most-watched actors</h3>
					<RankedBars
						data={byPerson(films, 'cast')}
						showAvg
						description="Films and average rating per actor"
					/>
				</div>
			</div>
		</section>

		<Recommendations {films} {watchlistIds} bind:includeWatchlist />

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
	<nav aria-label="Project links">
		<a href="https://codeberg.org/LaurinS/letterboxd-vizard">Source code</a>
		<a href="https://codeberg.org/LaurinS/letterboxd-vizard/issues">Report an issue</a>
		<a href="https://codeberg.org/LaurinS/letterboxd-vizard/pulls">Contribute</a>
	</nav>
	<p>
		Film metadata from <a href="https://www.themoviedb.org">TMDB</a>. This product uses the TMDB API
		but is not endorsed or certified by TMDB. Recommendations powered by
		<a href="https://trakt.tv">Trakt</a>. Some series data from
		<a href="https://thetvdb.com">TheTVDB</a>.
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
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
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
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 32px;
		align-items: start;
	}
	h3.spaced {
		margin-top: 24px;
	}
	@media (max-width: 900px) {
		.pair {
			grid-template-columns: minmax(0, 1fr);
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
	footer nav {
		display: flex;
		gap: 16px;
		margin-bottom: 8px;
	}
	@media (max-width: 640px) {
		.unmatched ul {
			columns: 1;
		}
	}
</style>
