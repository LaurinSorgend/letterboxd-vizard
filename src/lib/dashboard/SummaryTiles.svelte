<script lang="ts">
	import { effectiveCountries } from '$lib/film/countries';
	import { count, stars } from '$lib/format';
	import { getLibrary } from '$lib/library.svelte';
	import StatTiles from '$lib/viz/StatTiles.svelte';
	import { likedCount } from '$lib/viz/stats';
	import { avgRating, totalRuntimeMinutes } from '$lib/film/tally';

	const library = getLibrary();

	const tiles = $derived.by(() => {
		const films = library.films;
		const hours = Math.round(totalRuntimeMinutes(films) / 60);
		const countries = new Set(films.flatMap((f) => (f.tmdb ? effectiveCountries(f.tmdb) : [])));
		return [
			{ label: 'Films watched', value: String(films.length) },
			{ label: 'Hours watched', value: count(hours) },
			{ label: 'Countries', value: String(countries.size) },
			{ label: 'Your average rating', value: stars(avgRating(films), 2) },
			{ label: 'Films hearted', value: String(likedCount(films)) }
		];
	});
</script>

<StatTiles {tiles} />
