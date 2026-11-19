<script lang="ts">
	import { webHref } from '$lib/film/links';
	import type { Film } from '$lib/types';

	let {
		film,
		class: className = '',
		title = film.name
	}: { film: Pick<Film, 'uri' | 'name'>; class?: string; title?: string | null } = $props();

	const href = $derived(webHref(film.uri));
</script>

{#if href}
	<a class={className} {href} target="_blank" rel="noopener" title={title ?? undefined}
		>{film.name}</a
	>
{:else}
	<span class={className} title={title ?? undefined}>{film.name}</span>
{/if}
