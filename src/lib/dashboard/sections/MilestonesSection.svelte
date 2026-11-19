<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import Milestones from '$lib/viz/Milestones.svelte';
	import { buildMilestones } from '$lib/viz/milestones';

	const library = getLibrary();

	const milestones = $derived(buildMilestones(library.films));
</script>

{#if milestones.length > 0}
	<Section id="milestones" title="Milestones">
		<Milestones {milestones} />
	</Section>
{/if}
