<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import { formatDays } from '$lib/format';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { medianWatchLag, watchLag } from '$lib/viz/stats';

	const library = getLibrary();

	const medianLag = $derived(medianWatchLag(library.films));
</script>

<Section id="lag" title="From release to watch" nav="Release to watch">
	{#if medianLag !== null}
		<p class="chart-note">
			Median gap: {formatDays(medianLag)} from release to first watch.
		</p>
	{/if}
	<RankedBars
		data={watchLag(library.films)}
		description="Films and average rating per gap between release and first watch"
	/>
</Section>
