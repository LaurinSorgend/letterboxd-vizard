<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import Tooltip from './Tooltip.svelte';

	/** How close the pointer must come, in screen pixels, before a point claims the tooltip. */
	const HOVER_REACH = 22;

	let {
		width = $bindable(0),
		height,
		label,
		points,
		xy,
		hover = $bindable(null),
		tooltip,
		children
	}: {
		/** The frame's measured width; bind it to size the scales. */
		width?: number;
		height: number;
		label: string;
		/** Hoverable points, with `xy` giving each one's position in the frame. */
		points: T[];
		xy: (point: T) => [number, number];
		hover?: T | null;
		tooltip: Snippet<[T]>;
		/** The SVG content. */
		children: Snippet;
	} = $props();

	let wrapper: HTMLElement | undefined = $state();
	let hoverPos = $state({ x: 0, y: 0 });

	function onMove(event: PointerEvent) {
		if (!wrapper) return;
		const box = wrapper.getBoundingClientRect();
		const x = event.clientX - box.left;
		const y = event.clientY - box.top;
		let best: T | null = null;
		let bestDistance = HOVER_REACH;
		for (const point of points) {
			const [px, py] = xy(point);
			const distance = Math.hypot(px - x, py - y);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = point;
			}
		}
		hover = best;
		if (best) {
			const [px, py] = xy(best);
			hoverPos = { x: px, y: py };
		}
	}
</script>

<div class="wrap" bind:this={wrapper} bind:clientWidth={width}>
	{#if width > 0 && points.length > 0}
		<svg
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			role="img"
			aria-label={label}
			onpointermove={onMove}
			onpointerleave={() => (hover = null)}
		>
			{@render children()}
		</svg>

		{#if hover}
			<Tooltip x={hoverPos.x} y={hoverPos.y} frameWidth={width} width={190}>
				{@render tooltip(hover)}
			</Tooltip>
		{/if}
	{/if}
</div>

<style>
	.wrap {
		position: relative;
	}
	svg {
		display: block;
		max-width: 100%;
		touch-action: pan-y;
	}
</style>
