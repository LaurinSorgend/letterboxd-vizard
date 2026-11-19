<script lang="ts" module>
	import { fetchReleaseDates } from '$lib/api/endpoints';
	import { CachedLookup, followLookup } from '$lib/api/lookup.svelte';

	/** Every country's dates per film, so switching country never asks the server again. */
	const lookup = new CachedLookup((id: number) => id, fetchReleaseDates);
</script>

<script lang="ts">
	import { noun } from '$lib/format';
	import RegionSelect from '$lib/region/RegionSelect.svelte';
	import { region as watchRegion } from '$lib/region/region.svelte';
	import {
		calendarEntries,
		clampMonth,
		localToday,
		monthKey,
		nextReleaseMonth,
		shiftMonth,
		upcomingCandidates,
		watchlistCalendarFilm,
		type CalendarFilm
	} from './calendar';
	import {
		RELEASE_KINDS,
		type EnrichedFilm,
		type ReleaseKind,
		type WatchlistFilm
	} from '$lib/types';
	import KindPicker from './KindPicker.svelte';
	import CalendarMonth from './CalendarMonth.svelte';
	import RecommendControls from './RecommendControls.svelte';

	let { watchlist, films }: { watchlist: WatchlistFilm[]; films: EnrichedFilm[] } = $props();

	const today = localToday();
	const thisMonth = monthKey(today);
	const from = `${thisMonth}-01`;
	const region = $derived(watchRegion.code);
	let kinds: ReleaseKind[] = $state([...RELEASE_KINDS]);
	let picked = $state(thisMonth);
	let recommendation = $state<{ region: string; films: CalendarFilm[] } | null>(null);

	const recommended = $derived(recommendation?.region === region ? recommendation.films : []);
	const candidates = $derived([
		...new Set([
			...upcomingCandidates(watchlist, today),
			...recommended.flatMap((film) => (film.tmdb ? [film.tmdb.tmdbId] : []))
		])
	]);
	const unresolved = $derived(lookup.unresolved(candidates));
	const watchlistFilms = $derived(watchlist.map(watchlistCalendarFilm));
	const entries = $derived(
		calendarEntries([...watchlistFilms, ...recommended], lookup.values, region, kinds, from)
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

	followLookup(
		() => lookup,
		() => candidates
	);
</script>

<div class="form-controls">
	<div class="controls">
		<RegionSelect label="Release dates for" />
		<KindPicker legend="Release types" bind:kinds />
		<RecommendControls {films} {watchlist} {region} onresult={(r) => (recommendation = r)} />
	</div>

	<p class="summary" role="status">
		{#if lookup.loading}
			Looking up release dates… <span data-numeric>{lookup.progress.done}</span> /
			<span data-numeric>{lookup.progress.total}</span>
		{:else if upcoming.length === 0}
			{#if watchlist.length > 0}
				Nothing on your watchlist has a release of the picked types coming up.
			{/if}
		{:else}
			<span data-numeric>{upcoming.length}</span>
			{noun(upcoming.length, 'upcoming release')} across
			<span data-numeric>{new Set(upcoming.map((e) => e.film.key)).size}</span>
			watchlist films.
		{/if}
		{#if unresolved > 0}
			Could not look up <span data-numeric>{unresolved}</span>
			{noun(unresolved, 'film')}.
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
</style>
