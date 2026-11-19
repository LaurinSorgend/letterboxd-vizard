<script lang="ts">
	import type { PosterPalette } from './palette.svelte';

	let {
		palette,
		urls,
		onread
	}: {
		palette: PosterPalette;
		/** The posters on show; only the unread ones are fetched. */
		urls: (string | null)[];
		/** Called once the colours are in, to switch to the colour sort. */
		onread: () => void;
	} = $props();

	const unread = $derived(palette.unread(urls));

	async function read() {
		if (await palette.read(unread)) onread();
	}
</script>

{#if !palette.refused && unread.length > 0}
	<button type="button" onclick={read} disabled={palette.reading}>
		{palette.reading ? 'Reading colours…' : 'Sort by colour'}
	</button>
{/if}
{#if palette.reading}
	<progress value={palette.progress} max={unread.length} aria-label="Reading poster colours"
	></progress>
{/if}

<style>
	progress {
		width: 160px;
		accent-color: var(--accent);
	}
</style>
