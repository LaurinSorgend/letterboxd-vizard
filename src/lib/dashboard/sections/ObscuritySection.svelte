<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import { OBSCURE_VOTES } from '$lib/film/votes';
	import { count, percent } from '$lib/format';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { audienceBands } from '$lib/viz/stats';
	import { obscurityShare } from '$lib/film/tally';

	const library = getLibrary();

	const obscure = $derived(obscurityShare(library.films));
</script>

<Section id="obscurity" title="Crowds & deep cuts">
	{#if obscure !== null}
		<p class="chart-note">
			{percent(obscure)} of your films have fewer than {count(OBSCURE_VOTES)} ratings.
		</p>
	{/if}
	<RankedBars
		data={audienceBands(library.films)}
		description="Films and average rating per combined TMDB + IMDb vote-count band"
	/>
</Section>
