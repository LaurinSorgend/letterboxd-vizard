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
	let pinnedLabel: string | null = $state(null);
	const rows = $derived(expanded ? data : data.slice(0, limit));
	const max = $derived(Math.max(1, ...rows.map((d) => d.count)));
	const hasImages = $derived(data.some((d) => d.image !== undefined));
	const selected = $derived(
		selectedLabel === null ? null : (data.find((d) => d.label === selectedLabel) ?? null)
	);

	function toggle(label: string) {
		selectedLabel = selectedLabel === label ? null : label;
	}

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
			aria-pressed={selectedLabel === d.label}
			title="{d.label}: {d.count}{d.avg !== null ? `, avg ${d.avg.toFixed(1)}` : ''} — click to list films"
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
		border-radius: 50%;
	}
	.pic .preview {
		display: none;
		position: absolute;
		top: 28px;
		left: 0;
		width: 150px;
		height: auto;
		border-radius: 8px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--ctp-crust) 60%, transparent);
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
