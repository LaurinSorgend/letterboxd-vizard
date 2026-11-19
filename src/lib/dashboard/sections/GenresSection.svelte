<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { byGenre, byLanguage } from '$lib/film/tally';

	const library = getLibrary();
</script>

<Section id="genres" title="Genres & languages">
	<div class="pair">
		<div>
			<h3>Genres</h3>
			<RankedBars data={byGenre(library.films)} description="Films and average rating per genre" />
		</div>
		<div>
			<h3>Original language</h3>
			<RankedBars
				data={byLanguage(library.films)}
				description="Films and average rating per language"
			/>
		</div>
	</div>
</Section>
