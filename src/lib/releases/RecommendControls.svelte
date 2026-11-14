<script lang="ts">
	import type { EnrichedFilm, WatchlistFilm } from '$lib/types';
	import type { CalendarFilm } from './calendar';
	import { RELEASE_KINDS, type ReleaseKind } from './dates';
	import { KINDS } from './kinds';
	import { recommendUpcoming, type RecommendPhase } from './recommendUpcoming';

	let {
		films,
		watchlist,
		region,
		onresult
	}: {
		films: EnrichedFilm[];
		watchlist: WatchlistFilm[];
		region: string;
		onresult: (result: { region: string; kinds: ReleaseKind[]; films: CalendarFilm[] }) => void;
	} = $props();

	let kinds: ReleaseKind[] = $state([...RELEASE_KINDS]);
	let phase = $state<RecommendPhase | 'idle' | 'done' | 'error'>('idle');
	let progress = $state({ done: 0, total: 0 });
	let count = $state(0);
	let controller: AbortController | null = null;

	const running = $derived(phase === 'searching' || phase === 'enriching');

	function onProgress(next: RecommendPhase, done: number, total: number) {
		phase = next;
		progress = { done, total };
	}

	async function recommend() {
		controller?.abort();
		const current = new AbortController();
		controller = current;
		const snapshot = { region, kinds: [...kinds] };
		phase = 'searching';
		try {
			const result = await recommendUpcoming(
				films,
				watchlist,
				snapshot.region,
				snapshot.kinds,
				onProgress,
				current.signal
			);
			onresult({ ...snapshot, films: result });
			count = result.length;
			phase = 'done';
		} catch {
			if (!current.signal.aborted) phase = 'error';
		}
	}

	$effect(() => () => controller?.abort());
</script>

<fieldset>
	<legend>Recommend releases for</legend>
	{#each RELEASE_KINDS as kind (kind)}
		<label style:--kind-colour={KINDS[kind].colour}>
			<input type="checkbox" value={kind} bind:group={kinds} />
			<span class="swatch" aria-hidden="true"></span>
			{KINDS[kind].label}
		</label>
	{/each}
</fieldset>
<button type="button" onclick={recommend} disabled={running || kinds.length === 0}>
	Recommend upcoming releases
</button>
<p class="summary" role="status">
	{#if phase === 'searching'}
		Searching upcoming releases…
	{:else if phase === 'enriching'}
		Comparing with your favourites… <span class="num">{progress.done}</span> /
		<span class="num">{progress.total}</span>
	{:else if phase === 'done' && count > 0}
		<span class="num">{count}</span> recommended films, marked Rec in the calendar.
	{:else if phase === 'done'}
		No upcoming release matches your favourites closely enough. Recommendations use films you rated
		4 stars or more, or liked.
	{:else if phase === 'error'}
		Could not load recommendations. Try again in a minute.
	{/if}
</p>

<style>
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
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.num {
		font-family: var(--font-mono);
	}
</style>
