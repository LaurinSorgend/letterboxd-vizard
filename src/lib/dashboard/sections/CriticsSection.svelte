<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import MetacriticDisagreement from '$lib/viz/MetacriticDisagreement.svelte';
	import RatingContrarian from '$lib/viz/RatingContrarian.svelte';
	import RatingCorrelation from '$lib/viz/RatingCorrelation.svelte';
	import RatingRadar from '$lib/viz/RatingRadar.svelte';

	const library = getLibrary();

	const films = $derived(library.films);
	const hasOmdb = $derived(films.some((f) => f.omdb));
</script>

{#if hasOmdb}
	<Section id="triangulation" title="Critical consensus & rating triangulation" nav="Critics">
		<h3>Where you diverge, film by film</h3>
		<RatingRadar {films} />

		<h3 class="spaced">Critics vs. crowds</h3>
		<RatingContrarian {films} />

		<h3 class="spaced">Biggest disagreements with Metacritic</h3>
		<MetacriticDisagreement {films} />

		<h3 class="spaced">Which source best predicts your taste</h3>
		<RatingCorrelation {films} />
	</Section>
{/if}
