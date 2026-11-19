<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import RecentWatches from '$lib/viz/RecentWatches.svelte';
	import { recentWatches } from '$lib/viz/stats';

	const library = getLibrary();

	const recent = $derived(recentWatches(library.films));
</script>

{#if recent.length > 0}
	<Section id="recent" title="Recently watched">
		<RecentWatches watches={recent} />
	</Section>
{/if}
