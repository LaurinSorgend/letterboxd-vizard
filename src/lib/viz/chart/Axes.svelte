<script lang="ts">
	import { MARGIN } from './plot';

	let {
		width,
		height,
		yTicks,
		xTicks,
		baseline,
		xLabel
	}: {
		width: number;
		height: number;
		/** Gridlines with their labels, by pixel position. */
		yTicks: { y: number; label: string }[];
		xTicks: { x: number; label: string }[];
		/** Pixel position of the x axis line. */
		baseline: number;
		xLabel: string;
	} = $props();
</script>

{#each yTicks as tick (tick.label)}
	<line class="grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={tick.y} y2={tick.y} />
	<text class="tick" data-numeric x={MARGIN.left - 6} y={tick.y} text-anchor="end" dy="0.32em">
		{tick.label}
	</text>
{/each}

<line class="axis" x1={MARGIN.left} x2={width - MARGIN.right} y1={baseline} y2={baseline} />
{#each xTicks as tick (tick.label)}
	<text class="tick" data-numeric x={tick.x} y={height - MARGIN.bottom + 16} text-anchor="middle">
		{tick.label}
	</text>
{/each}
<text
	class="axis-label"
	x={(MARGIN.left + width - MARGIN.right) / 2}
	y={height - 4}
	text-anchor="middle"
>
	{xLabel}
</text>

<style>
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
</style>
