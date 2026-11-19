<script lang="ts">
	import GapList from './GapList.svelte';
	import { extremes, starGapsTo, TMDB } from '$lib/film/ratings';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const gaps = $derived(extremes(starGapsTo(films, TMDB), 5));
</script>

<GapList
	lists={[
		{ title: 'You liked these more than TMDB', rows: gaps.over },
		{ title: 'TMDB liked these more than you', rows: gaps.under }
	]}
	empty="No rated films with a TMDB score yet."
>
	{#snippet nums(row)}
		you <strong>{row.yours}</strong> · TMDB <strong>{row.source.toFixed(1)}</strong>
	{/snippet}
</GapList>
