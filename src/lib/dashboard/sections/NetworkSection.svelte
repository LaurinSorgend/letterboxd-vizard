<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import Network from '$lib/viz/Network.svelte';

	const library = getLibrary();
</script>

<Section id="network" title="How your films connect" nav="Film network">
	<Network films={library.films} />
</Section>
