<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import PeopleTimeline from '$lib/viz/PeopleTimeline.svelte';

	const library = getLibrary();
</script>

<Section id="people-timeline" title="Watching them over time" nav="People over time">
	<PeopleTimeline films={library.films} />
</Section>
