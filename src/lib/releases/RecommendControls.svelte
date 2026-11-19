<script lang="ts">
	import type { CalendarFilm } from './calendar';
	import {
		RELEASE_KINDS,
		type EnrichedFilm,
		type ReleaseKind,
		type WatchlistFilm
	} from '$lib/types';
	import KindPicker from './KindPicker.svelte';
	import { FAVOURITE_RATING } from '$lib/recommend/taste';
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
		onresult: (result: { region: string; films: CalendarFilm[] }) => void;
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
			onresult({ region: snapshot.region, films: result });
			count = result.length;
			phase = 'done';
		} catch {
			if (!current.signal.aborted) phase = 'error';
		}
	}

	$effect(() => () => controller?.abort());
</script>

<KindPicker legend="Recommend releases for" bind:kinds />
<button type="button" onclick={recommend} disabled={running || kinds.length === 0}>
	Recommend upcoming releases
</button>
<p class="summary" role="status">
	{#if phase === 'searching'}
		Searching upcoming releases…
	{:else if phase === 'enriching'}
		Comparing with your favourites… <span data-numeric>{progress.done}</span> /
		<span data-numeric>{progress.total}</span>
	{:else if phase === 'done' && count > 0}
		<span data-numeric>{count}</span> recommended films, marked Rec in the calendar.
	{:else if phase === 'done'}
		No upcoming release matches your favourites closely enough. Recommendations use films you rated
		{FAVOURITE_RATING} stars or more, or liked.
	{:else if phase === 'error'}
		Could not load recommendations. Try again in a minute.
	{/if}
</p>

<style>
	.summary {
		margin: 0;
	}
</style>
