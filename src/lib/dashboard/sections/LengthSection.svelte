<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import Scatter from '$lib/viz/Scatter.svelte';

	const library = getLibrary();
</script>

<Section id="length" title="Does length buy quality?" nav="Length vs. rating">
	<Scatter films={library.films} />
</Section>
