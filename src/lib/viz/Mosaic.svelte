<script lang="ts">
	import { latestWatch } from '$lib/film/diary';
	import { starCaption } from '$lib/format';
	import ColourSortButton from '$lib/posters/ColourSortButton.svelte';
	import { PosterPalette } from '$lib/posters/palette.svelte';
	import PosterGrid from '$lib/posters/PosterGrid.svelte';
	import { posterUrl } from '$lib/posters/posters';
	import { releaseYear } from '$lib/film/release';
	import { byRatingThenName } from './FilmList.svelte';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	type Sort = 'rating' | 'watched' | 'year' | 'colour';
	const PAGE = 300;

	let sort: Sort = $state('rating');
	let expanded = $state(false);
	const palette = new PosterPalette();

	const poster = (film: EnrichedFilm) => posterUrl(film.tmdb, 'w154');

	function compare(a: EnrichedFilm, b: EnrichedFilm): number {
		if (sort === 'rating') return byRatingThenName(a, b);
		if (sort === 'watched') return (latestWatch(b) ?? '').localeCompare(latestWatch(a) ?? '');
		if (sort === 'year') return (releaseYear(b) ?? 0) - (releaseYear(a) ?? 0);
		return palette.compare(poster(a), poster(b));
	}

	const ordered = $derived(
		[...films].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name))
	);

	function label(film: EnrichedFilm): string {
		const year = releaseYear(film);
		const rating = film.rating !== null ? `, ${starCaption(film.rating)}` : '';
		return `${film.name}${year ? ` (${year})` : ''}${rating}`;
	}
</script>

<div class="form-controls">
	<div class="controls">
		<label>
			Order
			<select bind:value={sort}>
				<option value="rating">Your rating</option>
				<option value="watched">Recently watched</option>
				<option value="year">Release year</option>
				<option value="colour" disabled={!palette.ready}>Colour spectrum</option>
			</select>
		</label>
		<ColourSortButton
			{palette}
			urls={(expanded ? ordered : ordered.slice(0, PAGE)).map(poster)}
			onread={() => (sort = 'colour')}
		/>
	</div>

	<PosterGrid films={ordered} page={PAGE} bind:expanded dense {poster} {label} />
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
</style>
