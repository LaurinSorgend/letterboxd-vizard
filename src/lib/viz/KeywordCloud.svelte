<script lang="ts">
	import FilmList from './FilmList.svelte';
	import { selectByLabel } from './selection.svelte';
	import { sizeStep } from './keywords';
	import type { BarDatum } from './stats';

	let {
		data,
		limit = 120,
		description
	}: { data: BarDatum[]; limit?: number; description: string } = $props();

	const shown = $derived(data.slice(0, limit));
	const max = $derived(Math.max(1, ...shown.map((d) => d.count)));
	const selection = selectByLabel(() => data);

	function title(d: BarDatum): string {
		const avg = d.avg !== null ? `, avg ★ ${d.avg.toFixed(1)}` : '';
		return `${d.label}: ${d.count} films${avg} — click to list them`;
	}
</script>

<div class="cloud" role="group" aria-label={description}>
	{#each shown as d (d.label)}
		<button
			type="button"
			class="step-{sizeStep(d.count, max)}"
			aria-pressed={selection.isSelected(d.label)}
			title={title(d)}
			onclick={() => selection.toggle(d.label)}
		>
			{d.label}
		</button>
	{/each}
</div>

{#if data.length > limit}
	<p class="note">
		Showing the <span data-numeric>{limit}</span> most common of
		<span data-numeric>{data.length}</span> keywords. Switch to bars for the full list and the ratings
		behind each one.
	</p>
{/if}

{#if selection.selected}
	{@const selected = selection.selected}
	<FilmList title={selected.label} films={selected.films} />
{/if}

<style>
	.cloud {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 14px;
	}
	button {
		font-family: var(--font-display);
		line-height: var(--leading-tight);
		padding: 0;
		margin: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
	}
	button:hover {
		color: var(--accent);
	}
	button[aria-pressed='true'] {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/*
	 * Size carries frequency and the ink weight follows it. Colour deliberately encodes nothing:
	 * the data ramp is built for fills, and its pale end is unreadable as text.
	 */
	.step-0 {
		font-size: var(--text-xs);
		color: var(--fg-muted);
	}
	.step-1 {
		font-size: var(--text-sm);
		color: var(--fg-muted);
	}
	.step-2 {
		font-size: var(--text-base);
		color: var(--fg-secondary);
	}
	.step-3 {
		font-size: var(--text-md);
		color: var(--fg-secondary);
	}
	.step-4 {
		font-size: var(--text-lg);
		color: var(--fg);
	}
	.step-5 {
		font-size: var(--text-xl);
		color: var(--fg);
	}

	.note {
		margin: 12px 0 0;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
</style>
