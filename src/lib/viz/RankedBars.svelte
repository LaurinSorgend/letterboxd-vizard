<script lang="ts">
	import FilmList from './FilmList.svelte';
	import type { BarDatum } from './stats';

	let {
		data,
		limit = 12,
		showAvg = false,
		description
	}: { data: BarDatum[]; limit?: number; showAvg?: boolean; description: string } = $props();

	let expanded = $state(false);
	let selectedLabel: string | null = $state(null);
	const rows = $derived(expanded ? data : data.slice(0, limit));
	const max = $derived(Math.max(1, ...rows.map((d) => d.count)));
	const hasImages = $derived(data.some((d) => d.image !== undefined));
	const selected = $derived(
		selectedLabel === null ? null : (data.find((d) => d.label === selectedLabel) ?? null)
	);

	function toggle(label: string) {
		selectedLabel = selectedLabel === label ? null : label;
	}
</script>

<div class="chart" class:with-images={hasImages} role="group" aria-label={description}>
	{#each rows as d (d.label)}
		{#if hasImages}
			<span class="pic">
				{#if d.image}
					<img src={d.image} alt="" loading="lazy" width="24" height="24" />
				{/if}
			</span>
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
			aria-pressed={selectedLabel === d.label}
			title="{d.label}: {d.count}{d.avg !== null
				? `, avg ${d.avg.toFixed(1)}`
				: ''} — click to list films"
			onclick={() => toggle(d.label)}
		>
			<span class="bar" style="width: {(d.count / max) * 100}%"></span>
			<span class="val">{d.count}</span>
		</button>
		{#if showAvg}
			<span class="avg">{d.avg !== null ? `★ ${d.avg.toFixed(1)}` : '—'}</span>
		{/if}
	{/each}
</div>
{#if data.length > limit}
	<button type="button" class="more" onclick={() => (expanded = !expanded)}>
		{expanded ? 'Show fewer' : `Show all (${data.length})`}
	</button>
{/if}
{#if selected}
	<FilmList title={selected.label} films={selected.films} />
{/if}

<style>
	.chart {
		display: grid;
		grid-template-columns: minmax(72px, max-content) 1fr auto;
		gap: 4px 12px;
		align-items: center;
	}
	.chart.with-images {
		grid-template-columns: 24px minmax(72px, max-content) 1fr auto;
		gap: 4px 8px;
	}
	.pic {
		width: 24px;
		height: 24px;
	}
	.pic img {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		object-fit: cover;
		display: block;
		background: var(--surface);
	}
	.lab {
		font-size: 0.875rem;
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
		border-radius: 4px;
	}
	.bar {
		height: 14px;
		min-width: 2px;
		background: var(--accent);
		border-radius: 0 4px 4px 0;
	}
	.track:hover .bar {
		filter: brightness(1.15);
	}
	button.track[aria-pressed='true'] .bar {
		box-shadow: 0 0 0 1.5px var(--fg);
	}
	.val {
		font-size: 0.75rem;
		color: var(--fg-muted);
		font-variant-numeric: tabular-nums;
	}
	.avg {
		font-size: 0.75rem;
		color: var(--fg-secondary);
		font-variant-numeric: tabular-nums;
		justify-self: end;
	}
	.more {
		margin-top: 8px;
		padding: 4px 12px;
		font: inherit;
		font-size: 0.875rem;
		color: var(--fg);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
	}
	.more:hover {
		background: var(--surface);
	}
</style>
