<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import { page } from '$app/state';
	import CountryRec from '$lib/recommend/CountryRec.svelte';
	import WorldMap from '$lib/viz/WorldMap.svelte';

	const library = getLibrary();

	const initialMetric = page.url.searchParams.get('metric') === 'rating' ? 'rating' : 'count';
	const presetCountry = page.url.searchParams.get('country');
</script>

<Section id="world" title="Your films around the world" nav="World map">
	<WorldMap films={library.films} {initialMetric} {presetCountry}>
		{#snippet countryDetail(country)}
			<CountryRec
				code={country.code}
				name={country.name}
				films={country.films}
				exclude={library.recommendExclude}
			/>
		{/snippet}
	</WorldMap>
</Section>
