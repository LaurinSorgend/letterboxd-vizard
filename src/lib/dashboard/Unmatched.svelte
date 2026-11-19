<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';

	const library = getLibrary();
	const unmatched = $derived(library.films.filter((f) => !f.tmdb));
</script>

{#if unmatched.length > 0}
	<details>
		<summary>{unmatched.length} films could not be matched on TMDB</summary>
		<ul>
			{#each unmatched as film (film.uri)}
				<li>{film.name} ({film.year ?? 'unknown year'})</li>
			{/each}
		</ul>
	</details>
{/if}

<style>
	summary {
		cursor: pointer;
		color: var(--fg-secondary);
	}
	ul {
		color: var(--fg-secondary);
		columns: 2;
	}
	@media (max-width: 640px) {
		ul {
			columns: 1;
		}
	}
</style>
