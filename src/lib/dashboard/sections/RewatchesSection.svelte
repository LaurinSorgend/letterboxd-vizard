<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { mostRewatched } from '$lib/viz/stats';

	const library = getLibrary();

	const rewatched = $derived(mostRewatched(library.films));
</script>

{#if rewatched.length > 0}
	<Section id="rewatches" title="Films you return to">
		<RankedBars data={rewatched} description="Diary entries per rewatched film" />
	</Section>
{/if}
