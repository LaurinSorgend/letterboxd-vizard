<script lang="ts" module>
	import { fetchReleaseDates } from '$lib/ingest/enrich';
	import { CachedLookup } from '$lib/ingest/lookup.svelte';

	/** Every country's dates per film, so switching country never asks the server again. */
	const lookup = new CachedLookup((id: number) => id, fetchReleaseDates);
</script>

<script lang="ts">
	import RegionSelect from '$lib/region/RegionSelect.svelte';
	import { initialRegion } from '$lib/region/region';
	import type { EnrichedFilm, WatchlistFilm } from '$lib/types';
	import {
		calendarEntries,
		clampMonth,
		localToday,
		monthKey,
		nextReleaseMonth,
		shiftMonth,
		sortEntries,
		upcomingCandidates,
		type CalendarFilm
	} from './calendar';
	import { RELEASE_KINDS, type ReleaseKind } from './dates';
	import { KINDS } from './kinds';
	import CalendarMonth from './CalendarMonth.svelte';
	import RecommendControls from './RecommendControls.svelte';

	let { watchlist, films }: { watchlist: WatchlistFilm[]; films: EnrichedFilm[] } = $props();

	const today = localToday();
	const thisMonth = monthKey(today);
	const from = `${thisMonth}-01`;
	let region = $state(initialRegion());
	let kinds: ReleaseKind[] = $state([...RELEASE_KINDS]);
	let picked = $state(thisMonth);
	let recommendation = $state<{
		region: string;
		kinds: ReleaseKind[];
		films: CalendarFilm[];
	} | null>(null);

	const recommended = $derived(recommendation?.region === region ? recommendation.films : []);
	const candidates = $derived([
		...new Set([
			...upcomingCandidates(watchlist, today),
			...recommended.flatMap((film) => (film.tmdb ? [film.tmdb.tmdbId] : []))
		])
	]);
	const unresolved = $derived(lookup.loading ? 0 : lookup.missing(candidates));
	const entries = $derived(
		sortEntries([
			...calendarEntries(watchlist, lookup.values, region, kinds, from),
			...calendarEntries(recommended, lookup.values, region, recommendation?.kinds ?? [], from)
		])
	);
	const upcoming = $derived(
		entries.filter((entry) => entry.date >= today && !entry.film.recommended)
	);
	const lastMonth = $derived(entries.length > 0 ? monthKey(entries.at(-1)!.date) : thisMonth);
	const month = $derived(clampMonth(picked, thisMonth, lastMonth));
	const nextMonth = $derived(nextReleaseMonth(entries, month));
	const inMonth = $derived(entries.filter((entry) => monthKey(entry.date) === month).length);
	const monthName = $derived(
		new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en', {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		})
	);

	$effect(() => {
		const controller = new AbortController();
		void lookup.load(candidates, controller.signal);
		return () => controller.abort();
	});
</script>

<div class="form-controls">
	<div class="controls">
		<RegionSelect label="Release dates for" {region} onchange={(next) => (region = next)} />
		<fieldset>
			<legend>Release types</legend>
			{#each RELEASE_KINDS as kind (kind)}
				<label style:--kind-colour={KINDS[kind].colour}>
					<input type="checkbox" value={kind} bind:group={kinds} />
					<span class="swatch" aria-hidden="true"></span>
					{KINDS[kind].label}
				</label>
			{/each}
		</fieldset>
		<RecommendControls {films} {watchlist} {region} onresult={(r) => (recommendation = r)} />
	</div>

	<p class="summary" role="status">
		{#if lookup.loading}
			Looking up release dates… <span class="num">{lookup.progress.done}</span> /
			<span class="num">{lookup.progress.total}</span>
		{:else if upcoming.length === 0}
			{#if watchlist.length > 0}
				Nothing on your watchlist has a release of the picked types coming up.
			{/if}
		{:else}
			<span class="num">{upcoming.length}</span>
			{upcoming.length === 1 ? 'upcoming release' : 'upcoming releases'} across
			<span class="num">{new Set(upcoming.map((e) => e.film.tmdb?.tmdbId ?? e.film.uri)).size}</span
			>
			watchlist films.
		{/if}
		{#if unresolved > 0}
			Could not look up <span class="num">{unresolved}</span>
			{unresolved === 1 ? 'film' : 'films'}.
		{/if}
	</p>

	<nav class="months" aria-label="Month">
		<button
			type="button"
			onclick={() => (picked = shiftMonth(month, -1))}
			disabled={month <= thisMonth}
		>
			Previous
		</button>
		<h3 aria-live="polite">{monthName} <span class="count">({inMonth})</span></h3>
		<button
			type="button"
			onclick={() => (picked = shiftMonth(month, 1))}
			disabled={month >= lastMonth}
		>
			Next
		</button>
		{#if inMonth === 0 && nextMonth}
			<button type="button" onclick={() => (picked = nextMonth ?? month)}>Next release</button>
		{/if}
	</nav>

	<CalendarMonth {month} {entries} {today} />

	<p class="credit">
		Release dates from <a href="https://www.themoviedb.org">TMDB</a>.
	</p>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 24px;
		align-items: end;
		margin-bottom: 16px;
	}
	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		border: none;
		margin: 0;
		padding: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	fieldset label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		cursor: pointer;
	}
	fieldset input {
		accent-color: var(--accent);
		margin: 0;
	}
	.swatch {
		width: 10px;
		height: 10px;
		background: var(--kind-colour);
	}
	.summary {
		margin: 0 0 12px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.num,
	.count {
		font-family: var(--font-mono);
	}
	.months {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin-bottom: 12px;
	}
	.months h3 {
		margin: 0;
		min-width: 12ch;
		text-align: center;
	}
	.count {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.credit {
		margin-top: 16px;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
</style>
