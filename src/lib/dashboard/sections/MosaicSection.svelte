<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import Mosaic from '$lib/viz/Mosaic.svelte';

	const library = getLibrary();
</script>

<Section id="mosaic" title="Every film you have watched" nav="All films">
	<Mosaic films={library.films} />
</Section>
