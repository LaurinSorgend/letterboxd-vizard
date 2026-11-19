<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import Heatmap from '$lib/viz/Heatmap.svelte';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import {
		bucketsByDay,
		buildDailyHeatmap,
		buildSeasonalHeatmap,
		buildWeeklyHeatmap,
		type HeatMetric,
		type SeasonScale
	} from '$lib/viz/heatmap';

	const library = getLibrary();

	const currentYear = new Date().getFullYear();
	let heatMetric: HeatMetric = $state('rating');
	let seasonScale: SeasonScale = $state('genre');

	const dayBuckets = $derived(bucketsByDay(library.films));
	const dailyHeatmap = $derived(buildDailyHeatmap(dayBuckets, currentYear));
	const weeklyHeatmap = $derived(buildWeeklyHeatmap(dayBuckets));
	const seasonalHeatmap = $derived(buildSeasonalHeatmap(library.films, seasonScale));
</script>

<Section id="when" title="When you watch">
	<MetricToggle
		name="heat-metric"
		label="Heatmap metric"
		options={[
			{ value: 'watchtime', label: 'Watchtime' },
			{ value: 'rating', label: 'Average rating' }
		]}
		bind:value={heatMetric}
	/>
	<h3>This year, day by day</h3>
	<Heatmap grid={dailyHeatmap} metric={heatMetric} />
	<h3 class="spaced">Every week, year over year</h3>
	<Heatmap grid={weeklyHeatmap} metric={heatMetric} />
	<h3 class="spaced">Genres by month, every year pooled</h3>
	{#if heatMetric === 'watchtime'}
		<MetricToggle
			name="season-scale"
			label="Genre heatmap scale"
			options={[
				{ value: 'genre', label: 'Each genre on its own scale' },
				{ value: 'global', label: 'One scale for all genres' }
			]}
			bind:value={seasonScale}
		/>
	{/if}
	<Heatmap grid={seasonalHeatmap} metric={heatMetric} cellSize={26} fitWidth />
</Section>
