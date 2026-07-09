<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import FileDrop from '$lib/FileDrop.svelte';
	import WorldMap from '$lib/viz/WorldMap.svelte';
	import { parseExport } from '$lib/ingest/parse';
	import { enrichFilms } from '$lib/ingest/enrich';
	import type { EnrichedFilm, LetterboxdData } from '$lib/types';

	type Phase = 'idle' | 'working' | 'ready';
	let phase: Phase = $state('idle');
	let data: LetterboxdData | null = $state(null);
	let films: EnrichedFilm[] = $state([]);
	let progress = $state({ done: 0, total: 0 });
	let errorMessage: string | null = $state(null);

	const unmatched = $derived(films.filter((f) => !f.tmdb));

	onMount(async () => {
		if (dev && page.url.searchParams.has('demo')) {
			const response = await fetch('/demo-export.zip');
			if (response.ok) handleFile(new File([await response.blob()], 'demo.zip'));
		}
	});

	async function handleFile(file: File) {
		errorMessage = null;
		phase = 'working';
		try {
			data = parseExport(new Uint8Array(await file.arrayBuffer()));
			progress = { done: 0, total: data.films.length };
			films = await enrichFilms(data.films, (done, total) => (progress = { done, total }));
			phase = 'ready';
		} catch (cause) {
			errorMessage = cause instanceof Error ? cause.message : String(cause);
			phase = 'idle';
		}
	}
</script>

<svelte:head>
	<title>Letterboxd Vizard</title>
</svelte:head>

<main>
	<header>
		<h1>Letterboxd Vizard</h1>
		{#if data?.profile && phase === 'ready'}
			<p class="sub">
				{data.profile.givenName || data.profile.username} · {films.length} films watched
			</p>
		{/if}
	</header>

	{#if phase === 'idle'}
		{#if errorMessage}
			<p class="error" role="alert">
				{errorMessage} — make sure you drop the unmodified zip downloaded from Letterboxd.
			</p>
		{/if}
		<FileDrop onfile={handleFile} />
	{:else if phase === 'working'}
		<div class="progress" role="status">
			{#if progress.total === 0}
				<p>Reading your export…</p>
			{:else}
				<p>Looking up film data… {progress.done} / {progress.total}</p>
				<progress value={progress.done} max={progress.total}></progress>
				<p class="sub">First run fetches from TMDB; repeat visits are instant thanks to caching.</p>
			{/if}
		</div>
	{:else}
		<section>
			<h2>Your films around the world</h2>
			<WorldMap {films} />
		</section>

		{#if unmatched.length > 0}
			<details class="unmatched">
				<summary>{unmatched.length} films could not be matched on TMDB</summary>
				<ul>
					{#each unmatched as film (film.uri)}
						<li>{film.name} ({film.year ?? 'unknown year'})</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</main>

<footer>
	<p>
		Film metadata from <a href="https://www.themoviedb.org">TMDB</a>. This product uses the TMDB
		API but is not endorsed or certified by TMDB.
	</p>
</footer>

<style>
	main {
		max-width: 1080px;
		margin: 0 auto;
		padding: 24px 16px;
	}
	header {
		margin-bottom: 24px;
	}
	h1 {
		margin: 0;
	}
	.sub {
		color: var(--fg-secondary);
		margin: 4px 0 0;
	}
	.error {
		padding: 8px 12px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--error) 12%, transparent);
		color: var(--error);
	}
	.progress {
		text-align: center;
		padding: 48px 0;
	}
	progress {
		width: min(400px, 100%);
		accent-color: var(--accent);
	}
	section {
		margin-bottom: 32px;
	}
	.unmatched summary {
		cursor: pointer;
		color: var(--fg-secondary);
	}
	.unmatched ul {
		color: var(--fg-secondary);
		columns: 2;
	}
	footer {
		max-width: 1080px;
		margin: 0 auto;
		padding: 16px;
		border-top: 1px solid var(--border);
		font-size: 0.75rem;
		color: var(--fg-muted);
	}
	@media (max-width: 640px) {
		.unmatched ul {
			columns: 1;
		}
	}
</style>
