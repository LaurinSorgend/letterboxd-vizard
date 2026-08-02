<script lang="ts">
	import { runtimeBuckets } from './stats';
	import {
		describeFit,
		excludedCount,
		linearFit,
		runtimeRatingPoints,
		type Point
	} from './scatter';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const MARGIN = { top: 12, right: 12, bottom: 34, left: 40 };
	/** Candidate x-axis steps in minutes; the first that keeps the axis under ten ticks wins. */
	const TICK_STEPS = [15, 30, 60, 120, 300];
	/** How close the pointer must come, in screen pixels, before a point claims the tooltip. */
	const HOVER_REACH = 22;
	const Y_MIN = 0.25;
	const Y_MAX = 5.25;

	let wrapper: HTMLElement | undefined = $state();
	let width = $state(0);
	let hover: Point | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0 });

	const height = $derived(Math.min(420, Math.max(260, width * 0.5)));
	const points = $derived(runtimeRatingPoints(films));
	const fit = $derived(linearFit(points));
	const dropped = $derived(excludedCount(films));

	/* Spread as a loop, not Math.max(...points): a large library would overflow the argument list. */
	const extent = $derived.by(() => {
		let min = Infinity;
		let max = -Infinity;
		for (const p of points) {
			if (p.runtime < min) min = p.runtime;
			if (p.runtime > max) max = p.runtime;
		}
		return points.length > 0 ? { min, max } : { min: 0, max: 0 };
	});

	const step = $derived(
		TICK_STEPS.find((s) => (extent.max - extent.min) / s <= 9) ?? TICK_STEPS[TICK_STEPS.length - 1]
	);

	const domain = $derived({
		min: Math.floor(extent.min / step) * step,
		max: Math.max(Math.ceil(extent.max / step) * step, Math.floor(extent.min / step) * step + step)
	});

	const plot = $derived({
		w: Math.max(1, width - MARGIN.left - MARGIN.right),
		h: Math.max(1, height - MARGIN.top - MARGIN.bottom)
	});

	function px(runtime: number): number {
		const span = domain.max - domain.min || 1;
		return MARGIN.left + ((runtime - domain.min) / span) * plot.w;
	}

	function py(rating: number): number {
		return MARGIN.top + ((Y_MAX - rating) / (Y_MAX - Y_MIN)) * plot.h;
	}

	const xTicks = $derived.by(() => {
		const ticks: number[] = [];
		for (let t = domain.min; t <= domain.max; t += step) ticks.push(t);
		return ticks;
	});
	const yTicks = [1, 2, 3, 4, 5];

	/** The fitted line clipped to the plotted runtime range. */
	const trend = $derived.by(() => {
		if (!fit) return null;
		const at = (runtime: number) =>
			Math.min(Y_MAX, Math.max(Y_MIN, fit.intercept + fit.slope * runtime));
		return {
			x1: px(domain.min),
			y1: py(at(domain.min)),
			x2: px(domain.max),
			y2: py(at(domain.max))
		};
	});

	function onMove(event: PointerEvent) {
		if (!wrapper) return;
		const box = wrapper.getBoundingClientRect();
		const x = event.clientX - box.left;
		const y = event.clientY - box.top;
		let best: Point | null = null;
		let bestDistance = HOVER_REACH;
		for (const p of points) {
			const distance = Math.hypot(px(p.runtime) - x, py(p.rating + p.jitter) - y);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = p;
			}
		}
		hover = best;
		if (best) {
			hoverPos = {
				x: Math.min(px(best.runtime) + 12, Math.max(0, box.width - 200)),
				y: py(best.rating + best.jitter) + 12
			};
		}
	}

	function formatRuntime(minutes: number): string {
		return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 || ''}` : `${minutes}m`;
	}

	const summary = $derived(
		fit
			? `Runtime against your rating for ${fit.n} films: r = ${fit.r.toFixed(2)}, ${describeFit(fit)}.`
			: 'Not enough rated films with a known runtime to plot.'
	);
	const bands = $derived(runtimeBuckets(points.map((p) => p.film)));
</script>

<div class="wrap" bind:this={wrapper} bind:clientWidth={width}>
	{#if width > 0 && points.length > 0}
		<svg
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			role="img"
			aria-label={summary}
			onpointermove={onMove}
			onpointerleave={() => (hover = null)}
		>
			{#each yTicks as rating (rating)}
				<line
					class="grid"
					x1={MARGIN.left}
					x2={width - MARGIN.right}
					y1={py(rating)}
					y2={py(rating)}
				/>
				<text
					class="tick"
					data-numeric
					x={MARGIN.left - 6}
					y={py(rating)}
					text-anchor="end"
					dy="0.32em"
				>
					{rating}
				</text>
			{/each}

			<line class="axis" x1={MARGIN.left} x2={width - MARGIN.right} y1={py(Y_MIN)} y2={py(Y_MIN)} />
			{#each xTicks as minutes (minutes)}
				<text
					class="tick"
					data-numeric
					x={px(minutes)}
					y={height - MARGIN.bottom + 16}
					text-anchor="middle"
				>
					{formatRuntime(minutes)}
				</text>
			{/each}
			<text
				class="axis-label"
				x={(MARGIN.left + width - MARGIN.right) / 2}
				y={height - 4}
				text-anchor="middle"
			>
				Runtime
			</text>

			{#each points as point (point.film.uri)}
				<circle class="dot" cx={px(point.runtime)} cy={py(point.rating + point.jitter)} r="4" />
			{/each}

			{#if trend}
				<line class="trend" x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2} />
			{/if}

			{#if hover}
				<circle
					class="dot active"
					cx={px(hover.runtime)}
					cy={py(hover.rating + hover.jitter)}
					r="6"
				/>
			{/if}
		</svg>

		{#if hover}
			<div class="tooltip" style="left: {hoverPos.x}px; top: {hoverPos.y}px">
				<strong>{hover.film.name}</strong>
				<div>
					<span data-numeric>{formatRuntime(hover.runtime)}</span>
					· <span data-numeric>★ {hover.rating}</span>
					{#if hover.film.tmdb?.year}
						· <span data-numeric>{hover.film.tmdb.year}</span>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if fit}
	<p class="readout">
		<span data-numeric>r = {fit.r.toFixed(2)}</span>
		across <span data-numeric>{fit.n.toLocaleString('en')}</span> films —
		{describeFit(fit)}.
	</p>
{/if}
<p class="note">
	Feature films only: series carry a whole-run length rather than a sitting, and shorts under 40
	minutes answer to different expectations.
	{#if dropped > 0}
		<span data-numeric>{dropped}</span> rated films are left out for that reason.
	{/if}
	Points are nudged vertically so that films sharing a rating stay countable.
</p>

<details>
	<summary>View as table</summary>
	<table>
		<thead>
			<tr><th>Runtime</th><th class="num">Films</th><th class="num">Avg rating</th></tr>
		</thead>
		<tbody>
			{#each bands as band (band.label)}
				<tr>
					<td>{band.label}</td>
					<td class="num" data-numeric>{band.count}</td>
					<td class="num" data-numeric>{band.avg !== null ? band.avg.toFixed(2) : '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</details>

<style>
	.wrap {
		position: relative;
	}
	svg {
		display: block;
		max-width: 100%;
		touch-action: pan-y;
	}
	.grid {
		stroke: var(--border);
	}
	.axis {
		stroke: var(--border-strong);
	}
	.tick {
		fill: var(--fg-muted);
		font-size: var(--text-2xs);
	}
	.axis-label {
		fill: var(--fg-secondary);
		font-size: var(--text-2xs);
	}
	.dot {
		fill: var(--accent);
		fill-opacity: 0.45;
		stroke: var(--bg);
		stroke-width: 1;
	}
	.dot.active {
		fill-opacity: 1;
		stroke: var(--fg);
		stroke-width: 2;
	}
	.trend {
		stroke: var(--fg);
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
	.tooltip {
		position: absolute;
		width: 190px;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		font-size: var(--text-sm);
		pointer-events: none;
		z-index: 1;
	}
	.readout {
		margin: 8px 0 0;
		font-size: var(--text-md);
	}
	.note {
		margin: 4px 0 0;
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
