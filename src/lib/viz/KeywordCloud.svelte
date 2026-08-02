<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import FilmList from './FilmList.svelte';
	import { selectByLabel } from './selection.svelte';
	import { sizeStep } from './keywords';
	import type { BarDatum } from './stats';
	import type { ECharts } from 'echarts';

	let {
		data,
		limit = 120,
		description
	}: { data: BarDatum[]; limit?: number; description: string } = $props();

	const shown = $derived(data.slice(0, limit));
	const selection = selectByLabel(() => data);

	/** Muted → full ink, same four tones the bar charts use for the equivalent step. */
	const FG_BY_STEP = [
		'--fg-muted',
		'--fg-muted',
		'--fg-secondary',
		'--fg-secondary',
		'--fg',
		'--fg'
	];

	let container: HTMLDivElement | undefined = $state();
	let chart: ECharts | undefined;
	let mediaQuery: MediaQueryList | undefined;
	let observer: MutationObserver | undefined;
	let resizeHandler: (() => void) | undefined;

	function themeColor(name: string): string {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	}

	/** Re-reads the current theme's colours on every call, so a flavour/accent switch repaints correctly. */
	function render() {
		if (!chart) return;
		const max = Math.max(1, ...shown.map((d) => d.count));
		const accent = themeColor('--accent');

		chart.setOption(
			{
				animation: false,
				tooltip: {
					formatter: (params: { name: string; value: number }) => {
						const word = shown.find((w) => w.label === params.name);
						const avg =
							word?.avg !== null && word?.avg !== undefined ? `, avg ★ ${word.avg.toFixed(1)}` : '';
						return `${params.name}: ${params.value} films${avg}`;
					}
				},
				series: [
					{
						type: 'wordCloud',
						shape: 'circle',
						left: 'center',
						top: 'center',
						width: '94%',
						height: '94%',
						gridSize: 6,
						rotationRange: [0, 0],
						sizeRange: [13, 46],
						drawOutOfBound: false,
						textStyle: {
							fontFamily: 'Ronzino, Arial, sans-serif',
							color: (params: { name: string }) => {
								if (selection.isSelected(params.name)) return accent;
								const word = shown.find((w) => w.label === params.name);
								const step = word ? sizeStep(word.count, max) : 0;
								return themeColor(FG_BY_STEP[step]);
							}
						},
						emphasis: { textStyle: { color: accent } },
						data: shown.map((d) => ({ name: d.label, value: d.count }))
					}
				]
			},
			true
		);
	}

	onMount(async () => {
		const [echarts] = await Promise.all([import('echarts'), import('echarts-wordcloud')]);
		if (!container) return;
		chart = echarts.init(container);
		render();
		chart.on('click', (params) => {
			if (params.componentType === 'series' && typeof params.name === 'string') {
				selection.toggle(params.name);
				render();
			}
		});

		resizeHandler = () => chart?.resize();
		window.addEventListener('resize', resizeHandler);
		mediaQuery = matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', render);
		observer = new MutationObserver(render);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-flavor', 'data-accent']
		});
	});

	onDestroy(() => {
		if (resizeHandler) window.removeEventListener('resize', resizeHandler);
		mediaQuery?.removeEventListener('change', render);
		observer?.disconnect();
		chart?.dispose();
	});

	$effect(() => {
		shown;
		if (chart) render();
	});
</script>

<div class="chart" role="img" aria-label={description} bind:this={container}></div>

{#if data.length > limit}
	<p class="note">
		The {limit} most common of {data.length} keywords. Bars view: the full list, with ratings.
	</p>
{/if}

{#if selection.selected}
	{@const selected = selection.selected}
	<FilmList title={selected.label} films={selected.films} />
{/if}

<details>
	<summary>View as table</summary>
	<table>
		<thead>
			<tr><th>Keyword</th><th class="num">Films</th><th class="num">Avg rating</th></tr>
		</thead>
		<tbody>
			{#each shown as d (d.label)}
				<tr>
					<td>{d.label}</td>
					<td class="num" data-numeric>{d.count}</td>
					<td class="num" data-numeric>{d.avg !== null ? d.avg.toFixed(1) : '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</details>

<style>
	.chart {
		width: 100%;
		height: 420px;
		margin-top: 8px;
	}

	.note {
		margin: 12px 0 0;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}

	details {
		margin-top: 12px;
	}
	summary {
		cursor: pointer;
		color: var(--fg-secondary);
		font-size: var(--text-sm);
	}
	table {
		border-collapse: collapse;
		margin-top: 8px;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: 4px 12px;
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	thead tr {
		background: var(--bg-secondary);
	}
	.num {
		text-align: right;
	}
</style>
