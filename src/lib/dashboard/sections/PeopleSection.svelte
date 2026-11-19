<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { byPerson } from '$lib/film/tally';

	const library = getLibrary();
</script>

<Section id="people" title="People">
	<div class="pair">
		<div>
			<h3>Most-watched directors</h3>
			<RankedBars
				data={byPerson(library.films, 'directors')}
				description="Films and average rating per director"
			/>
		</div>
		<div>
			<h3>Most-watched actors</h3>
			<RankedBars
				data={byPerson(library.films, 'cast')}
				description="Films and average rating per actor"
			/>
		</div>
	</div>
</Section>
