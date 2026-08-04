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
	import SectionNav from '$lib/viz/SectionNav.svelte';
	import Heatmap from '$lib/viz/Heatmap.svelte';
	import Scatter from '$lib/viz/Scatter.svelte';
	import KeywordCloud from '$lib/viz/KeywordCloud.svelte';
	import Network from '$lib/viz/Network.svelte';
	import Mosaic from '$lib/viz/Mosaic.svelte';
	import Milestones from '$lib/viz/Milestones.svelte';
	import PeopleTimeline from '$lib/viz/PeopleTimeline.svelte';
	import YearRecap from '$lib/viz/YearRecap.svelte';
	import { byKeyword, keywordCoverage } from '$lib/viz/keywords';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import {
		bucketsByDay,
		buildDailyHeatmap,
		buildSeasonalHeatmap,
		buildWeeklyHeatmap,
		type HeatMetric,
		type SeasonScale
	} from '$lib/viz/heatmap';
	import { effectiveCountries } from '$lib/viz/countries';
	import { buildMilestones } from '$lib/viz/milestones';
	import {
		audienceBands,
		avgRating,
		byGenre,
		byCollection,
		byLanguage,
		byPerson,
		collectionShare,
		formatDays,
		likeTotals,
		medianWatchLag,
		mostRewatched,
		obscurityShare,
		ratingHistogram,
		releaseDecades,
		runtimeBuckets,
		totalRuntimeMinutes,
		watchLag,
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
	let mainEl: HTMLElement | null = $state(null);

	const unmatched = $derived(films.filter((f) => !f.tmdb));
	const watchlistExclude = $derived(includeWatchlist ? [] : watchlistIds);

	const initialMetric = page.url.searchParams.get('metric') === 'rating' ? 'rating' : 'count';
	const presetCountry = page.url.searchParams.get('country');

	const currentYear = new Date().getFullYear();
	const dayBuckets = $derived(bucketsByDay(films));
	const dailyHeatmap = $derived(buildDailyHeatmap(dayBuckets, currentYear));
	const weeklyHeatmap = $derived(buildWeeklyHeatmap(dayBuckets));
	let heatMetric: HeatMetric = $state('rating');
	let seasonScale: SeasonScale = $state('genre');
	const seasonalHeatmap = $derived(buildSeasonalHeatmap(films, seasonScale));

	const rewatched = $derived(mostRewatched(films));
	const milestones = $derived(buildMilestones(films));
	const franchises = $derived(byCollection(films));
	const franchiseShare = $derived(collectionShare(films));
	const themes = $derived(byKeyword(films));
	const themeCoverage = $derived(keywordCoverage(films));
	let keywordView = $state<'cloud' | 'bars'>('cloud');
	const likes = $derived(likeTotals(films));
	const medianLag = $derived(medianWatchLag(films));
	const obscure = $derived(obscurityShare(films));
	let runtimeScope = $state<'films' | 'all'>('films');
	const justFilms = $derived(films.filter((f) => f.tmdb?.mediaType !== 'tv'));
	const hasSeries = $derived(films.some((f) => f.tmdb?.mediaType === 'tv' && f.tmdb.runtime));
	const runtimes = $derived(runtimeBuckets(runtimeScope === 'all' ? films : justFilms));

	const tiles = $derived.by(() => {
		const avg = avgRating(films);
		const hours = Math.round(totalRuntimeMinutes(films) / 60);
		const countries = new Set(films.flatMap((f) => (f.tmdb ? effectiveCountries(f.tmdb) : [])));
		return [
			{ label: 'Films watched', value: String(films.length) },
			{ label: 'Hours watched', value: hours.toLocaleString('en') },
			{ label: 'Countries', value: String(countries.size) },
			{ label: 'Your average rating', value: avg !== null ? avg.toFixed(2) + ' ★' : '—' },
			{ label: 'Films hearted', value: String(likes.liked) }
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
				'Could not save: your library is too large for this browser. Data stays for this visit only.';
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

<main bind:this={mainEl}>
	<header>
		<div>
			<div class="title">
				<img class="logo" src="/letterbox-vizard-icon.svg" alt="" width="40" height="40" />
				<h1>Letterboxd Vizard</h1>
			</div>
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
				{errorMessage}. Make sure you drop the unmodified zip downloaded from Letterboxd.
			</p>
		{/if}
		<FileDrop onfile={handleFile} />
	{:else if phase === 'working'}
		<div class="progress" role="status">
			{#if progress.total === 0}
				<p>Reading your export…</p>
			{:else}
				<p>Looking up film data… {progress.done} / {progress.total}</p>
				<progress value={progress.done} max={progress.total} aria-label="Film lookup progress"
				></progress>
				<p class="sub">First run only; lookups are cached, so next time is instant.</p>
			{/if}
		</div>
	{:else}
		<RememberToggle checked={remember} error={saveError} onchange={toggleRemember} />

		<SectionNav container={mainEl} />

		<StatTiles {tiles} />

		<section id="world">
			<h2>Your films around the world</h2>
			<WorldMap {films} {initialMetric} {presetCountry} {watchlistExclude} />
		</section>

		<section id="ratings">
			<h2>Rating habits</h2>
			<div class="pair">
				<div>
					<h3>How you rate, and what you heart</h3>
					<Columns
						data={ratingHistogram(films)}
						highlightLabel="Hearted"
						restLabel="Not hearted"
						description="Films per rating step, split by whether you hearted them"
					/>
					<p class="sub chart-note">
						{likes.liked} of your {films.length} films hearted.
						{#if likes.unrated > 0}
							{likes.unrated} of those carry no rating and sit outside these bars.
						{/if}
					</p>
				</div>
				<RatingGaps {films} />
			</div>
		</section>

		<section id="years">
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

		<section id="lag">
			<h2>From release to watch</h2>
			<p class="sub chart-note">
				{#if medianLag !== null}
					Median gap: {formatDays(medianLag)} from release to first watch.
				{/if}
				Films without a diary entry are left out.
			</p>
			<RankedBars
				data={watchLag(films)}
				showAvg
				description="Films and average rating per gap between release and first watch"
			/>
		</section>

		<section id="when">
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
			<h3 class="spaced">Genres by month, every year pooled</h3>
			{#if heatMetric === 'watchtime'}
				<MetricToggle
					name="season-scale"
					label="Genre heatmap scale"
					options={[
						{ value: 'genre', label: 'Each genre on its own scale' },
						{ value: 'global', label: 'One scale for all genres' }
					]}
					bind:value={seasonScale}
				/>
			{/if}
			<Heatmap grid={seasonalHeatmap} metric={heatMetric} cellSize={26} fitWidth />
		</section>

		<section id="runtime">
			<h2>How long you watch</h2>
			{#if hasSeries}
				<MetricToggle
					name="runtime-scope"
					label="Runtime scope"
					options={[
						{ value: 'films', label: 'Films only' },
						{ value: 'all', label: 'With series' }
					]}
					bind:value={runtimeScope}
				/>
			{/if}
			<RankedBars data={runtimes} showAvg description="Films and average rating per runtime band" />
		</section>

		<section id="length">
			<h2>Does length buy quality?</h2>
			<Scatter {films} />
		</section>

		{#if rewatched.length > 0}
			<section id="rewatches">
				<h2>Films you return to</h2>
				<p class="sub chart-note">
					Bars count diary entries. Films first seen before you started logging show one, even where
					Letterboxd marks the watch as a rewatch.
				</p>
				<RankedBars data={rewatched} showAvg description="Diary entries per rewatched film" />
			</section>
		{/if}

		<section id="genres">
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

		{#if franchises.length > 0}
			<section id="franchises">
				<h2>Franchises you follow</h2>
				<p class="sub chart-note">
					{franchiseShare.inCollection} of your {franchiseShare.total} matched films belong to a TMDB
					franchise. One-film franchises are left out.
				</p>
				<RankedBars
					data={franchises}
					showAvg
					description="Films and average rating per franchise"
				/>
			</section>
		{/if}

		{#if themes.length > 0}
			<section id="keywords">
				<h2>Themes you return to</h2>
				<p class="sub chart-note">
					A partial picture: TMDB keywords cover {themeCoverage.withKeywords} of your {themeCoverage.total}
					matched films. Shown from two shared films up, sized by count on a square-root scale.
				</p>
				<MetricToggle
					name="keyword-view"
					label="Keyword view"
					options={[
						{ value: 'cloud', label: 'Cloud' },
						{ value: 'bars', label: 'Bars' }
					]}
					bind:value={keywordView}
				/>
				{#if keywordView === 'cloud'}
					<KeywordCloud
						data={themes}
						description="Your most common TMDB keywords, sized by film count"
					/>
				{:else}
					<RankedBars
						data={themes}
						showAvg
						limit={20}
						description="Films and average rating per TMDB keyword"
					/>
				{/if}
			</section>
		{/if}

		<section id="obscurity">
			<h2>Crowds &amp; deep cuts</h2>
			<p class="sub chart-note">
				TMDB rating counts, as a stand-in for how widely seen each film is.
				{#if obscure !== null}
					{Math.round(obscure * 100)}% of yours: fewer than 1,000 ratings.
				{/if}
			</p>
			<RankedBars
				data={audienceBands(films)}
				showAvg
				description="Films and average rating per TMDB vote-count band"
			/>
		</section>

		<section id="people">
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

		<section id="people-timeline">
			<h2>Watching them over time</h2>
			<p class="sub chart-note">
				Cumulative hours watched of each selected person's films, across every diary date. Defaults
				to your top 2 directors and top 2 actors; search to add anyone else.
			</p>
			<PeopleTimeline {films} />
		</section>

		<section id="network">
			<h2>How your films connect</h2>
			<p class="sub chart-note">
				Films joined by shared billed cast or a director. Clusters are the corners of cinema you
				keep returning to. Pick a film to see its links.
			</p>
			<Network {films} />
		</section>

		<section id="mosaic">
			<h2>Every film you have watched</h2>
			<p class="sub chart-note">
				Your whole library as a wall of posters. Sort by rating, watch date or release year, or by
				the posters' own colours, laid out as a spectrum.
			</p>
			<Mosaic {films} />
		</section>

		{#if milestones.length > 0}
			<section id="milestones">
				<h2>Milestones</h2>
				<Milestones {milestones} />
			</section>
		{/if}

		<YearRecap {films} />

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
		<span aria-hidden="true">|</span>
		<a style="margin-left: 0em;" href="https://letterboxd.com/laurins0/">Built by Laurin</a>
	</nav>
	<p>
		An independent project, not affiliated with or endorsed by
		<a href="https://letterboxd.com">Letterboxd</a>. Film metadata and recommendations from
		<a href="https://www.themoviedb.org">TMDB</a>. This product uses the TMDB API but is not
		endorsed or certified by TMDB. Some series data from
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
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.logo {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
	}
	h1 {
		margin: 0;
	}
	.sub {
		color: var(--fg-secondary);
		margin: 4px 0 0;
	}
	.chart-note {
		margin-bottom: 16px;
	}
	.error {
		padding: 8px 12px;
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
		margin: 32px 0;
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
		font-size: var(--text-2xs);
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
