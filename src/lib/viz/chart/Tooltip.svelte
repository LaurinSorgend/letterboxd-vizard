<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Gap between the anchor point and the box. */
	const OFFSET = 12;
	/** Room the box keeps from the frame's right edge. */
	const EDGE = 10;

	let {
		x,
		y,
		frameWidth,
		width,
		above = false,
		children
	}: {
		/** The anchor point, in pixels from the frame's top left. */
		x: number;
		y: number;
		/** The frame's width, which the box never runs past. */
		frameWidth: number;
		/** A fixed box width in pixels; without one the content sizes it. */
		width?: number;
		/** Grow upward from the anchor instead of downward. */
		above?: boolean;
		children: Snippet;
	} = $props();

	let boxWidth = $state(0);
	const left = $derived(Math.max(0, Math.min(x + OFFSET, frameWidth - boxWidth - EDGE)));
	const top = $derived(above ? y - OFFSET : y + OFFSET);
</script>

<div
	class="tooltip"
	class:above
	style:left="{left}px"
	style:top="{top}px"
	style:width={width === undefined ? undefined : `${width}px`}
	bind:offsetWidth={boxWidth}
>
	{@render children()}
</div>

<style>
	.tooltip {
		position: absolute;
		padding: 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border);
		font-size: var(--text-sm);
		pointer-events: none;
		z-index: 1;
	}
	.above {
		transform: translateY(-100%);
	}
</style>
