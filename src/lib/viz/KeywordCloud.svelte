<script lang="ts">
	import DataTable from './chart/DataTable.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { fixed, stars } from '$lib/format';
	import { onThemeChange } from '$lib/theme';
	import FilmList from './FilmList.svelte';
	import { selectByKey } from './selection.svelte';
	import { sizeStep } from './keywords';
	import type { BarDatum } from '$lib/film/tally';
	import type { ECharts } from 'echarts';

	/** Words drawn at most; past this the cloud is noise. */
	const LIMIT = 120;

	let { data, description }: { data: BarDatum[]; description: string } = $props();

	const shown = $derived(data.slice(0, LIMIT));
	const selection = selectByKey(
		() => data,
		(d) => d.label
	);

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
	let stopThemeWatch: (() => void) | undefined;
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
							word?.avg !== null && word?.avg !== undefined ? `, avg ${stars(word.avg)}` : '';
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
		stopThemeWatch = onThemeChange(render);
	});

	onDestroy(() => {
		if (resizeHandler) window.removeEventListener('resize', resizeHandler);
		stopThemeWatch?.();
		chart?.dispose();
	});

	$effect(() => {
		shown;
		if (chart) render();
	});
</script>

<div class="chart" role="img" aria-label={description} bind:this={container}></div>

{#if selection.selected}
	{@const selected = selection.selected}
	<FilmList title={selected.label} films={selected.films} />
{/if}

<DataTable
	columns={[
		{ label: 'Keyword' },
		{ label: 'Films', numeric: true },
		{ label: 'Avg rating', numeric: true }
	]}
	rows={shown}
	key={(d) => d.label}
	cells={(d) => [d.label, d.count, fixed(d.avg, 1)]}
/>

<style>
	.chart {
		width: 100%;
		height: 420px;
		margin-top: 8px;
	}
</style>
