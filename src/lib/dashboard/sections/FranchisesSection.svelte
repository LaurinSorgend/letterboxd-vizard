<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { byCollection, collectionShare } from '$lib/film/tally';

	const library = getLibrary();

	const franchises = $derived(byCollection(library.films));
	const share = $derived(collectionShare(library.films));
</script>

{#if franchises.length > 0}
	<Section id="franchises" title="Franchises you follow" nav="Franchises">
		<p class="chart-note">
			{share.inCollection} of your {share.total} films are part of a franchise.
		</p>
		<RankedBars data={franchises} description="Films and average rating per franchise" />
	</Section>
{/if}
