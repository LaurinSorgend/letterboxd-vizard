<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
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

	type View = 'stats' | 'watchlist' | 'releases';
	const view: View = $derived.by(() => {
		const v = page.url.searchParams.get('view');
		return v === 'watchlist' || v === 'releases' ? v : 'stats';
	});
	const { stage, done, total } = $derived(library.progress);

	function showView(next: View) {
		const url = new URL(page.url);
		if (next === 'stats') url.searchParams.delete('view');
		else url.searchParams.set('view', next);
		void goto(url, { noScroll: true, keepFocus: true });
	}

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
	<header id="top">
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
		<div class="header-tools">
			<ThemeSwitch />
			<a class="repo-link" href="https://github.com/LaurinSorgend/vizard-for-letterboxd">
				<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
					<path
						fill="currentColor"
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
					/>
				</svg>
				GitHub
			</a>
		</div>
	</header>

	{#if library.phase === 'idle'}
		{#if library.canResume}
			<button type="button" class="small-button back" onclick={() => library.resume()}>
				Back to your stats
			</button>
		{/if}
		{#if library.error}
			<p class="error" role="alert">{library.error}</p>
		{/if}
		<FileDrop onfile={(file) => library.loadFile(file)} />
		<UsernameForm
			bind:value={library.usernameDraft}
			onsubmit={(username) => library.loadUsername(username)}
		/>
	{:else if library.phase === 'working'}
		<div class="progress" role="status">
			{#if total === 0}
				<p>
					{library.loadingSource === 'feed' ? 'Reading your diary feed…' : 'Reading your export…'}
				</p>
			{:else if stage === 'ratings'}
				<p>Looking up ratings… {done} / {total}</p>
				<progress value={done} max={total} aria-label="Ratings lookup progress"></progress>
			{:else}
				<p>Looking up film data… {done} / {total}</p>
				<progress value={done} max={total} aria-label="Film lookup progress"></progress>
			{/if}
			<button type="button" class="small-button cancel" onclick={() => library.cancel()}>
				Cancel
			</button>
		</div>
	{:else}
		<WrappedEntry
			films={library.films}
			watchlist={library.watchlist}
			collections={library.collections}
			viewer={library.displayName}
		/>

		{#if library.lookupFailed}
			<div class="lookup-failed" role="alert">
				<p>
					Film data could not be loaded for most of your films, so the numbers below are incomplete.
				</p>
				<button type="button" class="small-button" onclick={() => library.retryLookup()}>
					Try again
				</button>
			</div>
		{/if}

		<div class="library-actions">
			<RememberToggle
				checked={library.remember}
				error={library.saveError}
				onchange={(on) => library.setRemember(on)}
			/>
			<button type="button" class="small-button" onclick={() => library.startOver()}>
				Load another library
			</button>
		</div>

		{#if library.feedNote}
			<p class="feed-note" role="status">
				{library.feedNote}
				{#if library.offersExport}
					<button type="button" class="small-button" onclick={() => library.startOver()}>
						Upload an export
					</button>
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
			bind:value={() => view, showView}
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
		<a href="https://github.com/LaurinSorgend/vizard-for-letterboxd">Source code</a>
		<a href="https://github.com/LaurinSorgend/vizard-for-letterboxd/issues">Report an issue</a>
		<a href="https://github.com/LaurinSorgend/vizard-for-letterboxd/pulls">Contribute</a>
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
	.header-tools {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 8px 12px;
	}
	.repo-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.repo-link:hover {
		color: var(--fg);
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
	.small-button {
		font: inherit;
		padding: 2px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.small-button:hover {
		background: var(--surface);
	}
	.small-button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.feed-note button {
		margin-left: 8px;
	}
	.back {
		display: block;
		margin-bottom: 16px;
	}
	.cancel {
		display: block;
		margin: 16px auto 0;
	}
	.library-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 24px;
		margin: 8px 0 24px;
	}
	.library-actions :global(.remember) {
		margin: 0;
	}
	.error {
		padding: 8px 12px;
		background: color-mix(in srgb, var(--error) 12%, transparent);
		color: var(--error);
	}
	.lookup-failed {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		margin-bottom: 16px;
		padding: 8px 12px;
		background: color-mix(in srgb, var(--error) 12%, transparent);
		color: var(--error);
	}
	.lookup-failed p {
		margin: 0;
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
