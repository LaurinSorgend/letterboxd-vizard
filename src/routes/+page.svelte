<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import FileDrop from '$lib/FileDrop.svelte';
	import RememberToggle from '$lib/RememberToggle.svelte';
	import ThemeSwitch from '$lib/ThemeSwitch.svelte';
	import UsernameForm from '$lib/UsernameForm.svelte';
	import Section from '$lib/dashboard/Section.svelte';
	import SectionNav from '$lib/dashboard/SectionNav.svelte';
	import SummaryTiles from '$lib/dashboard/SummaryTiles.svelte';
	import Unmatched from '$lib/dashboard/Unmatched.svelte';
	import { SectionRegistry, setSections } from '$lib/dashboard/registry.svelte';
	import CriticsSection from '$lib/dashboard/sections/CriticsSection.svelte';
	import FranchisesSection from '$lib/dashboard/sections/FranchisesSection.svelte';
	import GenresSection from '$lib/dashboard/sections/GenresSection.svelte';
	import LagSection from '$lib/dashboard/sections/LagSection.svelte';
	import LengthSection from '$lib/dashboard/sections/LengthSection.svelte';
	import MilestonesSection from '$lib/dashboard/sections/MilestonesSection.svelte';
	import MosaicSection from '$lib/dashboard/sections/MosaicSection.svelte';
	import NetworkSection from '$lib/dashboard/sections/NetworkSection.svelte';
	import ObscuritySection from '$lib/dashboard/sections/ObscuritySection.svelte';
	import PeopleSection from '$lib/dashboard/sections/PeopleSection.svelte';
	import PeopleTimelineSection from '$lib/dashboard/sections/PeopleTimelineSection.svelte';
	import QuadrantsSection from '$lib/dashboard/sections/QuadrantsSection.svelte';
	import RatingsSection from '$lib/dashboard/sections/RatingsSection.svelte';
	import RecapSection from '$lib/dashboard/sections/RecapSection.svelte';
	import RecentSection from '$lib/dashboard/sections/RecentSection.svelte';
	import RewatchesSection from '$lib/dashboard/sections/RewatchesSection.svelte';
	import RuntimeSection from '$lib/dashboard/sections/RuntimeSection.svelte';
	import ThemesSection from '$lib/dashboard/sections/ThemesSection.svelte';
	import WhenSection from '$lib/dashboard/sections/WhenSection.svelte';
	import WorldSection from '$lib/dashboard/sections/WorldSection.svelte';
	import YearsSection from '$lib/dashboard/sections/YearsSection.svelte';
	import { Library, setLibrary } from '$lib/library.svelte';
	import RecommendationsSection from '$lib/dashboard/sections/RecommendationsSection.svelte';
	import ReleaseCalendar from '$lib/releases/ReleaseCalendar.svelte';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import Watchlist from '$lib/watchlist/Watchlist.svelte';
	import WrappedEntry from '$lib/wrapped/WrappedEntry.svelte';

	const library = setLibrary(new Library());
	setSections(new SectionRegistry());

	const requestedView = page.url.searchParams.get('view');
	let view: 'stats' | 'watchlist' | 'releases' = $state(
		requestedView === 'watchlist' || requestedView === 'releases' ? requestedView : 'stats'
	);
	const { stage, done, total } = $derived(library.progress);

	onMount(async () => {
		if (dev && page.url.searchParams.has('demo')) {
			const response = await fetch('/demo-export.zip');
			if (response.ok) library.loadFile(new File([await response.blob()], 'demo.zip'));
			return;
		}
		library.restore();
	});
</script>

<svelte:head>
	<title>Vizard for Letterboxd</title>
</svelte:head>

<main>
	<header>
		<div>
			<div class="title">
				<img class="logo" src="/vizard-icon.svg" alt="" width="40" height="40" />
				<h1>Vizard <span class="for">for Letterboxd</span></h1>
			</div>
			{#if library.profile && library.phase === 'ready'}
				<p class="sub">
					{library.displayName} · {library.films.length} films watched
				</p>
			{:else if library.phase === 'idle'}
				<p class="sub intro">
					Maps, charts and a year in review of everything you have logged on Letterboxd. Your export
					is read in your browser; only film titles and years are looked up.
				</p>
			{/if}
		</div>
		<ThemeSwitch />
	</header>

	{#if library.phase === 'idle'}
		{#if library.error}
			<p class="error" role="alert">{library.error}</p>
		{/if}
		<FileDrop onfile={(file) => library.loadFile(file)} />
		<UsernameForm onsubmit={(username) => library.loadUsername(username)} />
	{:else if library.phase === 'working'}
		<div class="progress" role="status">
			{#if total === 0}
				<p>Reading your export…</p>
			{:else if stage === 'ratings'}
				<p>Looking up ratings… {done} / {total}</p>
				<progress value={done} max={total} aria-label="Ratings lookup progress"></progress>
			{:else}
				<p>Looking up film data… {done} / {total}</p>
				<progress value={done} max={total} aria-label="Film lookup progress"></progress>
			{/if}
		</div>
	{:else}
		<WrappedEntry
			films={library.films}
			watchlist={library.watchlist}
			collections={library.collections}
			viewer={library.displayName}
		/>

		<RememberToggle
			checked={library.remember}
			error={library.saveError}
			onchange={(on) => library.setRemember(on)}
		/>

		{#if library.feedNote}
			<p class="feed-note" role="status">
				{library.feedNote}
				{#if library.offersExport}
					<button type="button" onclick={() => library.startOver()}>Upload an export</button>
				{/if}
			</p>
		{/if}

		<MetricToggle
			name="view"
			label="View"
			options={[
				{ value: 'stats', label: 'Your stats' },
				{ value: 'watchlist', label: `Your watchlist (${library.watchlist.length})` },
				{ value: 'releases', label: 'Release calendar' }
			]}
			bind:value={view}
		/>

		{#if view !== 'stats'}
			<Section id={view} title={view === 'releases' ? 'Upcoming releases' : 'Your watchlist'}>
				{#if library.watchlist.length === 0 && (view === 'watchlist' || library.films.length === 0)}
					<div class="empty-watchlist form-controls">
						<p>No watchlist yet.</p>
						<button type="button" onclick={() => library.startOver()}>Upload an export</button>
					</div>
				{:else if view === 'releases'}
					<ReleaseCalendar watchlist={library.watchlist} films={library.films} />
				{:else}
					<Watchlist watchlist={library.watchlist} />
				{/if}
			</Section>
		{:else}
			<SectionNav />
			<SummaryTiles />
			<WorldSection />
			<RecentSection />
			<RatingsSection />
			<CriticsSection />
			<YearsSection />
			<LagSection />
			<WhenSection />
			<RuntimeSection />
			<LengthSection />
			<RewatchesSection />
			<GenresSection />
			<FranchisesSection />
			<ThemesSection />
			<ObscuritySection />
			<QuadrantsSection />
			<PeopleSection />
			<PeopleTimelineSection />
			<NetworkSection />
			<MosaicSection />
			<MilestonesSection />
			<RecapSection />
			<RecommendationsSection />
			<Unmatched />
		{/if}
	{/if}
</main>

<footer>
	<nav aria-label="Project links">
		<a href="https://codeberg.org/LaurinS/letterboxd-vizard">Source code</a>
		<a href="https://codeberg.org/LaurinS/letterboxd-vizard/issues">Report an issue</a>
		<a href="https://codeberg.org/LaurinS/letterboxd-vizard/pulls">Contribute</a>
		<span aria-hidden="true">|</span>
		<a href="https://letterboxd.com/laurins0/">Built by Laurin</a>
	</nav>
	<p>
		An independent project, not affiliated with or endorsed by
		<a href="https://letterboxd.com">Letterboxd</a>. Film metadata and recommendations from
		<a href="https://www.themoviedb.org">TMDB</a>. This product uses the TMDB API but is not
		endorsed or certified by TMDB. Some series data from
		<a href="https://thetvdb.com">TheTVDB</a>. Streaming availability from
		<a href="https://www.justwatch.com">JustWatch</a>.
	</p>
</footer>

<style>
	main {
		max-width: var(--column);
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
	h1 .for {
		font-size: 0.55em;
		color: var(--fg-secondary);
	}
	.sub {
		color: var(--fg-secondary);
		margin: 4px 0 0;
	}
	.intro {
		margin-top: 12px;
		max-width: var(--measure-narrow);
	}
	.feed-note {
		color: var(--fg-secondary);
		margin: 0 0 24px;
	}
	.empty-watchlist {
		padding: 24px 0;
		color: var(--fg-secondary);
	}
	.feed-note button {
		font: inherit;
		margin-left: 8px;
		padding: 2px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.feed-note button:hover {
		background: var(--surface);
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
	footer {
		max-width: var(--column);
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
</style>
