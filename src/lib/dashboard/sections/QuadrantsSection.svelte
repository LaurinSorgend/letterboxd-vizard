<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import Quadrants from '$lib/viz/Quadrants.svelte';

	const library = getLibrary();
</script>

<Section id="quadrants" title="Popularity vs. your rating" nav="Popularity">
	<Quadrants films={library.films} />
</Section>
