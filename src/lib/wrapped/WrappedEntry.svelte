<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import Wrapped from './Wrapped.svelte';
	import { buildWrapped } from './wrapped';
	import { eligibleYears } from '$lib/viz/recap';
	import type { EnrichedFilm, WatchlistEntry } from '$lib/types';

	let {
		films,
		watchlist = [],
		viewer = null
	}: { films: EnrichedFilm[]; watchlist?: WatchlistEntry[]; viewer?: string | null } = $props();

	const now = new Date();
	const december = now.getMonth() === 11;
	const demo = $derived(dev && page.url.searchParams.has('demo'));

	/* December shows the running year; the demo route shows the latest year worth a deck
	 * so the surface can be worked on in any month. */
	const year = $derived.by(() => {
		if (december) return now.getFullYear();
		if (!demo) return null;
		const years = eligibleYears(films, now);
		return years.length > 0 ? Math.max(...years) : null;
	});
	const data = $derived(year === null ? null : buildWrapped(films, year, viewer));
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
		<span class="title">{data.year} Year in review</span>
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
		font-weight: 700;
	}
</style>
