<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import YearRecap from '$lib/wrapped/YearRecap.svelte';
	import { LABELS } from '$lib/wrapped/labels';
	import { recapYears } from '$lib/year';
	import Section from '../Section.svelte';

	const library = getLibrary();
	const years = $derived(recapYears(library.films, new Date()));
</script>

{#if years.length > 0}
	<Section id="recap" title={LABELS.title}>
		<YearRecap
			films={library.films}
			{years}
			watchlist={library.watchlist}
			collections={library.collections}
		/>
	</Section>
{/if}
