<script lang="ts">
	import FilmList from './FilmList.svelte';
	import { selectByLabel } from './selection.svelte';
	import type { BarDatum } from './stats';

	let {
		data,
		limit = 12,
		showAvg = false,
		description
	}: { data: BarDatum[]; limit?: number; showAvg?: boolean; description: string } = $props();

	let expanded = $state(false);
	let pinnedLabel: string | null = $state(null);
	const selection = selectByLabel(() => data);
	const rows = $derived(expanded ? data : data.slice(0, limit));
	const max = $derived(Math.max(1, ...rows.map((d) => d.count)));
	const hasImages = $derived(data.some((d) => d.image !== undefined));

	function togglePin(label: string) {
		pinnedLabel = pinnedLabel === label ? null : label;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && pinnedLabel !== null) pinnedLabel = null;
	}}
/>

<div class="chart" class:with-images={hasImages} role="group" aria-label={description}>
	{#each rows as d (d.label)}
		{#if hasImages}
			{#if d.imageLarge}
				<button
					type="button"
					class="pic"
					class:pinned={pinnedLabel === d.label}
					aria-pressed={pinnedLabel === d.label}
					aria-label="Show portrait of {d.label}"
					onclick={() => togglePin(d.label)}
				>
					{#if d.image}
						<img src={d.image} alt="" loading="lazy" width="24" height="24" />
					{/if}
					<img class="preview" src={d.imageLarge} alt="" loading="lazy" width="150" />
				</button>
			{:else}
				<span class="pic">
					{#if d.image}
						<img src={d.image} alt="" loading="lazy" width="24" height="24" />
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
			aria-pressed={selection.isSelected(d.label)}
			title="{d.label}: {d.count}{d.avg !== null
				? `, avg ${d.avg.toFixed(1)}`
				: ''} — click to list films"
			onclick={() => selection.toggle(d.label)}
		>
			<span class="bar" style="width: {(d.count / max) * 100}%"></span>
			<span class="val" data-numeric>{d.count}</span>
		</button>
		{#if showAvg}
			<span class="avg" data-numeric>{d.avg !== null ? `★ ${d.avg.toFixed(1)}` : '—'}</span>
		{/if}
	{/each}
</div>
{#if data.length > limit}
	<button type="button" class="more" onclick={() => (expanded = !expanded)}>
		{expanded ? 'Show fewer' : `Show all (${data.length})`}
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
		grid-template-columns: 24px minmax(72px, max-content) 1fr auto;
		gap: 4px 8px;
	}
	.pic {
		width: 24px;
		height: 24px;
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
		top: 28px;
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
		width: 24px;
		height: 24px;
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
		height: 14px;
		min-width: 2px;
		background: var(--accent);
	}
	.track:hover .bar {
		filter: brightness(1.15);
	}
	button.track[aria-pressed='true'] .bar {
		box-shadow: 0 0 0 1.5px var(--fg);
	}
	.val {
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.avg {
		font-size: var(--text-2xs);
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
