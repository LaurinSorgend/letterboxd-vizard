<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import Wrapped from './Wrapped.svelte';
	import { buildYear, deckYear } from '$lib/year';
	import type { CollectionParts, EnrichedFilm, WatchlistEntry } from '$lib/types';

	let {
		films,
		watchlist = [],
		collections = [],
		viewer = null
	}: {
		films: EnrichedFilm[];
		watchlist?: WatchlistEntry[];
		collections?: CollectionParts[];
		viewer?: string | null;
	} = $props();

	const demo = $derived(dev && page.url.searchParams.has('demo'));
	const year = $derived(deckYear(films, new Date(), { demo }));
	const data = $derived.by(() => {
		const built = year === null ? null : buildYear(films, year, { watchlist, collections });
		return built && { ...built, viewer };
	});
	let open = $state(false);

	/* The deck opens by itself once per year per browser, so a reader who has already seen
	 * it is never interrupted a second time. The demo route opens every time. */
	onMount(() => {
		if (!data) return;
		if (demo) {
			open = true;
			return;
		}
		const key = `wrapped-seen-${year}`;
		try {
			if (localStorage.getItem(key)) return;
			localStorage.setItem(key, '1');
		} catch {
			return;
		}
		open = true;
	});
</script>

{#if data}
	<button class="launch" onclick={() => (open = true)}>
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<path d="M6 3.5 20 12 6 20.5Z" fill="currentColor" />
		</svg>
		<span class="title">{year} Year in review</span>
	</button>

	{#if open}
		<Wrapped {data} onclose={() => (open = false)} />
	{/if}
{/if}

<style>
	.launch {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 56px;
		margin-bottom: 16px;
		padding: 10px 16px;
		font: inherit;
		text-align: left;
		color: var(--on-accent);
		background: var(--accent);
		border: 1px solid var(--accent);
		cursor: pointer;
	}
	.launch:hover {
		filter: brightness(1.1);
	}
	.launch:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.title {
		font-weight: 500;
	}
</style>
