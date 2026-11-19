<script lang="ts">
	import { contrarianScore, contrarianSources } from './contrarian';
	import GapList from './GapList.svelte';
	import MetricToggle from './MetricToggle.svelte';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	let sourceKey: 'rt' | 'imdb' = $state('rt');

	const sources = $derived(contrarianSources(films));
	const score = $derived(contrarianScore(sources));
	const active = $derived(sources.find((s) => s.key === sourceKey) ?? sources[0]);
	const lists = $derived(
		active
			? [
					{ title: `You rate above ${active.label}`, rows: active.over },
					{ title: `${active.label} rate above you`, rows: active.under }
				]
			: []
	);

	function direction(avgGap: number): string {
		return avgGap >= 0 ? 'above' : 'below';
	}
</script>

<div class="score">
	{#if score !== null}
		<p class="headline">
			<span class="num" data-numeric>{score.toFixed(1)}</span> point contrarianism score
		</p>
	{:else}
		<p class="sub">Not enough overlap with either source yet.</p>
	{/if}
	<ul class="breakdown">
		{#each sources as s (s.key)}
			<li>
				<span class="label">{s.label}</span>
				{#if s.avgGap !== null}
					<span class="val" data-numeric
						>{Math.abs(s.avgGap).toFixed(1)} {direction(s.avgGap)}, avg</span
					>
					<span class="count" data-numeric>({s.count} films)</span>
				{:else}
					<span class="val">no overlap</span>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<MetricToggle
	name="contrarian-source"
	label="Compare against"
	options={[
		{ value: 'rt', label: 'Rotten Tomatoes' },
		{ value: 'imdb', label: 'IMDb' }
	]}
	bind:value={sourceKey}
/>

<div class="lists">
	<GapList {lists} empty="No films diverge this way yet.">
		{#snippet nums(row)}
			you <strong>{row.yours.toFixed(0)}</strong> · them
			<strong>{row.source.toFixed(0)}</strong>
		{/snippet}
	</GapList>
</div>

<style>
	.score {
		margin-bottom: 12px;
	}
	.headline {
		margin: 0;
		font-size: var(--text-xl);
	}
	.headline .num {
		color: var(--accent);
		font-weight: 500;
	}
	.sub {
		margin: 4px 0 0;
		color: var(--fg-secondary);
		font-size: var(--text-sm);
	}
	.breakdown {
		list-style: none;
		margin: 12px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.breakdown li {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		align-items: baseline;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.breakdown .label {
		min-width: 160px;
		color: var(--fg-secondary);
	}
	.breakdown .count {
		color: var(--fg-muted);
	}
	.lists {
		margin-top: 16px;
	}
</style>
