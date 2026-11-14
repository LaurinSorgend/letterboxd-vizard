<script lang="ts" module>
	import type { FilmReleases } from './dates';

	/** Every country's dates per film, kept across mounts so views and countries switch for free. */
	const dateCache = new Map<number, FilmReleases>();
</script>

<script lang="ts">
	import { fetchReleaseDates } from '$lib/ingest/enrich';
	import { REGIONS, initialRegion, saveRegion } from '$lib/watchlist/region';
	import { RELEASE_KINDS, type ReleaseKind, type WatchlistFilm } from '$lib/types';
	import {
		calendarEntries,
		clampMonth,
		localToday,
		monthOf,
		nextReleaseMonth,
		shiftMonth,
		upcomingCandidates
	} from './calendar';
	import { regionReleases } from './dates';
	import { KIND_LABELS } from './kinds';
	import CalendarMonth from './CalendarMonth.svelte';

	let { watchlist, onupload }: { watchlist: WatchlistFilm[]; onupload: () => void } = $props();

	const today = localToday();
	const thisMonth = monthOf(today);
	let region = $state(initialRegion());
	let kinds: ReleaseKind[] = $state([...RELEASE_KINDS]);
	let picked = $state(thisMonth);
	let dates = $state(new Map(dateCache));
	let loaded = $state({ done: 0, total: 0 });

	const candidates = $derived(upcomingCandidates(watchlist, today));
	const loading = $derived(loaded.done < loaded.total);
	const unresolved = $derived(loading ? 0 : candidates.filter((id) => !dates.has(id)).length);
	const entries = $derived(
		calendarEntries(
			watchlist,
			(id) => {
				const releases = dates.get(id);
				return releases ? regionReleases(releases, region) : undefined;
			},
			kinds,
			`${thisMonth}-01`
		)
	);
	const upcoming = $derived(entries.filter((entry) => entry.date >= today));
	const lastMonth = $derived(
		entries.length > 0 ? monthOf(entries[entries.length - 1].date) : thisMonth
	);
	const month = $derived(clampMonth(picked, thisMonth, lastMonth));
	const nextMonth = $derived(nextReleaseMonth(entries, month));
	const inMonth = $derived(entries.filter((entry) => monthOf(entry.date) === month).length);
	const monthName = $derived(
		new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en', {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		})
	);

	$effect(() => {
		const controller = new AbortController();
		void loadDates(candidates, controller.signal);
		return () => controller.abort();
	});

	/**
	 * Fetches only the films the cache lacks. Whatever an aborted run found still lands in the
	 * cache, and the next run asks for the rest, so `unresolved` always counts what is missing.
	 */
	async function loadDates(ids: number[], signal: AbortSignal) {
		const missing = ids.filter((id) => !dateCache.has(id));
		dates = new Map(dateCache);
		loaded = { done: 0, total: missing.length };
		if (missing.length === 0) return;
		const found = await fetchReleaseDates(
			missing,
			(done, total) => {
				if (!signal.aborted) loaded = { done, total };
			},
			signal
		);
		for (const [id, value] of found) dateCache.set(id, value);
		if (signal.aborted) return;
		dates = new Map(dateCache);
		loaded = { done: missing.length, total: missing.length };
	}

	function changeRegion(next: string) {
		region = next;
		saveRegion(next);
	}
</script>

{#if watchlist.length === 0}
	<div class="empty">
		<p>
			The release calendar is built from the <code>watchlist.csv</code> in your Letterboxd export. A library
			loaded by username has none, since Letterboxd's RSS feed leaves the watchlist out.
		</p>
		<button type="button" onclick={onupload}>Upload an export</button>
	</div>
{:else}
	<div class="releases">
		<div class="controls">
			<label>
				Release dates for
				<select value={region} onchange={(e) => changeRegion(e.currentTarget.value)}>
					{#each REGIONS as option (option.code)}
						<option value={option.code}>{option.name}</option>
					{/each}
				</select>
			</label>
			<fieldset>
				<legend>Release types</legend>
				{#each RELEASE_KINDS as kind (kind)}
					<label class="inline kind-{kind}">
						<input type="checkbox" value={kind} bind:group={kinds} />
						<span class="swatch" aria-hidden="true"></span>
						{KIND_LABELS[kind]}
					</label>
				{/each}
			</fieldset>
		</div>

		<p class="summary" role="status">
			{#if loading}
				Looking up release dates… <span class="num">{loaded.done}</span> /
				<span class="num">{loaded.total}</span>
			{:else if upcoming.length === 0}
				Nothing on your watchlist has a release of the picked types coming up.
			{:else}
				<span class="num">{upcoming.length}</span>
				{upcoming.length === 1 ? 'upcoming release' : 'upcoming releases'} across
				<span class="num">{new Set(upcoming.map((e) => e.film.uri)).size}</span> watchlist films.
			{/if}
			{#if !loading && unresolved > 0}
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

		{#if !loading && inMonth === 0}
			<p class="summary">No releases of the picked types in {monthName}.</p>
		{/if}
		<CalendarMonth {month} {entries} {today} {region} />

		<p class="credit">
			Release dates from <a href="https://www.themoviedb.org">TMDB</a>. Films without dates for the
			chosen country show their US dates, marked (US).
		</p>
	</div>
{/if}

<style>
	.releases :global(.kind-theatrical) {
		--kind-colour: var(--ctp-peach);
	}
	.releases :global(.kind-digital) {
		--kind-colour: var(--ctp-mauve);
	}
	.releases :global(.kind-physical) {
		--kind-colour: var(--ctp-teal);
	}
	.releases select,
	.releases button,
	.empty button {
		font: inherit;
		font-size: var(--text-sm);
		padding: 4px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		cursor: pointer;
	}
	.releases button:hover:not(:disabled),
	.empty button:hover {
		background: var(--surface);
	}
	.releases button:disabled {
		cursor: default;
		color: var(--fg-muted);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 24px;
		align-items: end;
		margin-bottom: 16px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
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
	label.inline {
		flex-direction: row;
		align-items: center;
		gap: 6px;
		color: var(--fg);
		cursor: pointer;
	}
	label.inline input {
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
	.empty {
		padding: 24px 0;
		color: var(--fg-secondary);
	}
</style>
