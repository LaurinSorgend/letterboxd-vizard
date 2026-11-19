<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import KeywordCloud from '$lib/viz/KeywordCloud.svelte';
	import { byKeyword } from '$lib/viz/keywords';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';

	const library = getLibrary();

	let keywordView = $state<'cloud' | 'bars'>('cloud');
	const themes = $derived(byKeyword(library.films));
</script>

{#if themes.length > 0}
	<Section id="keywords" title="Themes you return to" nav="Themes">
		<MetricToggle
			name="keyword-view"
			label="Keyword view"
			options={[
				{ value: 'cloud', label: 'Cloud' },
				{ value: 'bars', label: 'Bars' }
			]}
			bind:value={keywordView}
		/>
		{#if keywordView === 'cloud'}
			<KeywordCloud
				data={themes}
				description="Your most common TMDB keywords, sized by film count"
			/>
		{:else}
			<RankedBars
				data={themes}
				limit={20}
				description="Films and average rating per TMDB keyword"
			/>
		{/if}
	</Section>
{/if}
