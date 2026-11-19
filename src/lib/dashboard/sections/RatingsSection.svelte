<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import Columns from '$lib/viz/Columns.svelte';
	import RatingGaps from '$lib/viz/RatingGaps.svelte';
	import { likedCount, ratingHistogram } from '$lib/viz/stats';

	const library = getLibrary();

	const films = $derived(library.films);
	const liked = $derived(likedCount(films));
</script>

<Section id="ratings" title="Rating habits">
	<div class="pair">
		<div>
			<h3>How you rate, and what you heart</h3>
			<Columns
				data={ratingHistogram(films)}
				segments={{ highlighted: 'Hearted', rest: 'Not hearted' }}
				description="Films per rating step, split by whether you hearted them"
			/>
			<p class="chart-note">
				{liked} of your {films.length} films hearted.
			</p>
		</div>
		<RatingGaps {films} />
	</div>
</Section>
