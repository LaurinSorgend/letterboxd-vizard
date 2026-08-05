<script lang="ts">
	import { contrarianScore, contrarianSources } from './contrarian';
	import { webHref } from './href';
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
		<p class="sub">Mean absolute gap between your rating and each source, on a 0-100 scale.</p>
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

<div class="gaps">
	{#each lists as list (list.title)}
		<div>
			<h3>{list.title}</h3>
			<ul>
				{#each list.rows as row (row.film.uri)}
					<li>
						<a
							class="name"
							href={webHref(row.film.uri) ?? undefined}
							target="_blank"
							rel="noopener"
							title={row.film.name}
						>
							{row.film.name}
						</a>
						<span class="nums" data-numeric>
							you <strong>{row.yours.toFixed(0)}</strong> · them
							<strong>{row.source.toFixed(0)}</strong>
						</span>
					</li>
				{:else}
					<li class="empty">No films diverge this way yet.</li>
				{/each}
			</ul>
		</div>
	{/each}
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
		font-weight: 700;
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
		gap: 8px;
		align-items: baseline;
		font-size: var(--text-sm);
	}
	.breakdown .label {
		min-width: 160px;
		color: var(--fg-secondary);
	}
	.breakdown .count {
		color: var(--fg-muted);
	}
	.gaps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 24px;
		margin-top: 16px;
	}
	h3 {
		margin: 0 0 8px;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--accent);
		text-decoration: none;
	}
	.name:hover {
		text-decoration: underline;
	}
	.nums {
		color: var(--fg-secondary);
		white-space: nowrap;
	}
	.empty {
		color: var(--fg-muted);
		border-bottom: none;
	}
</style>
