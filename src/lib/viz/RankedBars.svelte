<script lang="ts">
	import { stars } from '$lib/format';
	import FilmList from './FilmList.svelte';
	import { selectByKey } from './selection.svelte';
	import type { BarDatum } from '$lib/film/tally';

	let {
		data,
		limit = 12,
		description
	}: { data: BarDatum[]; limit?: number; description: string } = $props();

	let expanded = $state(false);
	let pinnedKey: string | null = $state(null);
	const selection = selectByKey(
		() => data,
		(d) => d.key
	);
	const rows = $derived(expanded ? data : data.slice(0, limit));
	const max = $derived(Math.max(1, ...rows.map((d) => d.count)));
	const hasImages = $derived(data.some((d) => d.image !== undefined));
	// The accent marks the top entry; when every entry ties, nothing leads.
	const lead = $derived.by(() => {
		const top = Math.max(0, ...data.map((d) => d.count));
		return data.some((d) => d.count < top) ? top : null;
	});

	function togglePin(key: string) {
		pinnedKey = pinnedKey === key ? null : key;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && pinnedKey !== null) pinnedKey = null;
	}}
/>

<div class="chart" class:with-images={hasImages} role="group" aria-label={description}>
	{#each rows as d (d.key)}
		{#if hasImages}
			{#if d.imageLarge}
				<button
					type="button"
					class="pic"
					class:pinned={pinnedKey === d.key}
					aria-pressed={pinnedKey === d.key}
					aria-label="Show portrait of {d.label}"
					onclick={() => togglePin(d.key)}
				>
					{#if d.image}
						<img src={d.image} alt="" loading="lazy" width="40" height="40" />
					{/if}
					<img class="preview" src={d.imageLarge} alt="" loading="lazy" width="150" />
				</button>
			{:else}
				<span class="pic">
					{#if d.image}
						<img src={d.image} alt="" loading="lazy" width="40" height="40" />
					{/if}
				</span>
			{/if}
		{/if}
		<span class="lab" title={d.label}>
			{#if d.href}
				<a href={d.href} target="_blank" rel="noopener">{d.label}</a>
			{:else}
				{d.label}
			{/if}
		</span>
		<button
			type="button"
			class="track"
			aria-pressed={selection.isSelected(d.key)}
			title="{d.label}: {d.count}{d.avg !== null
				? `, avg ${d.avg.toFixed(1)}`
				: ''}; click to list films"
			onclick={() => selection.toggle(d.key)}
		>
			<span class="bar" class:lead={d.count === lead} style="width: {(d.count / max) * 100}%"
			></span>
			<span class="val" data-numeric>{d.count}</span>
		</button>
		<span class="avg" data-numeric>{stars(d.avg)}</span>
	{/each}
</div>
{#if data.length > limit}
	<button type="button" class="more" onclick={() => (expanded = !expanded)}>
		{#if expanded}
			Show fewer
		{:else}
			Show all (<span data-numeric>{data.length}</span>)
		{/if}
	</button>
{/if}
{#if selection.selected}
	{@const selected = selection.selected}
	<FilmList title={selected.label} films={selected.films} />
{/if}

<style>
	.chart {
		display: grid;
		grid-template-columns: minmax(72px, max-content) 1fr auto;
		gap: 4px 12px;
		align-items: center;
		position: relative;
	}
	.chart.with-images {
		grid-template-columns: 40px minmax(72px, max-content) 1fr auto;
		gap: 4px 8px;
	}
	.pic {
		width: 40px;
		height: 40px;
		position: relative;
	}
	button.pic {
		padding: 0;
		margin: 0;
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.pic .preview {
		display: none;
		position: absolute;
		top: 44px;
		left: 0;
		width: 150px;
		height: auto;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		z-index: 10;
	}
	button.pic:hover .preview,
	button.pic:focus-visible .preview,
	button.pic.pinned .preview {
		display: block;
	}
	.pic img {
		width: 40px;
		height: 40px;
		object-fit: cover;
		display: block;
		background: var(--surface);
	}
	.lab {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lab a {
		color: var(--accent);
		text-decoration: none;
	}
	.lab a:hover {
		text-decoration: underline;
	}
	.track {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	button.track {
		font: inherit;
		padding: 0;
		margin: 0;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
	}
	.bar {
		height: 18px;
		min-width: 2px;
		background: var(--bar);
	}
	.bar.lead {
		background: var(--accent);
	}
	.track:hover .bar {
		filter: brightness(1.15);
	}
	button.track[aria-pressed='true'] .bar {
		box-shadow: 0 0 0 1.5px var(--fg);
	}
	.val {
		font-size: var(--text-sm);
		color: var(--fg-muted);
	}
	.avg {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		justify-self: end;
	}
	.more {
		margin-top: 8px;
		padding: 4px 12px;
		font: inherit;
		font-size: var(--text-sm);
		color: var(--fg);
		background: transparent;
		border: 1px solid var(--border);
		cursor: pointer;
	}
	.more:hover {
		background: var(--surface);
	}
</style>
