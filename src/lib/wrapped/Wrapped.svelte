<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import Frame from './Frame.svelte';
	import { buildScenes } from './scenes';
	import { deliver, paletteFrom } from './canvas';
	import { storyCard, summaryCard } from './cards';
	import type { Wrapped } from './wrapped';

	let { data, onclose }: { data: Wrapped; onclose: () => void } = $props();

	const scenes = $derived(buildScenes(data));
	const reduced =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let dialog: HTMLDialogElement | null = $state(null);
	let index = $state(0);
	let direction = $state(1);
	let playing = $state(!reduced);
	let pulling = $state(false);
	let busy = $state(false);
	let message: string | null = $state(null);
	let posterPreview: string | null = $state(null);

	const scene = $derived(scenes[Math.min(index, scenes.length - 1)]);
	const last = $derived(index >= scenes.length - 1);

	function go(step: number) {
		const next = index + step;
		if (next < 0 || next >= scenes.length) return;
		direction = step;
		index = next;
		message = null;
		pulling = true;
		setTimeout(() => (pulling = false), 420);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') go(1);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') go(-1);
		else if (event.key === ' ') playing = !playing;
		else return;
		event.preventDefault();
	}

	let swipeFrom = 0;
	function onpointerdown(event: PointerEvent) {
		swipeFrom = event.pointerType === 'touch' ? event.clientY : 0;
	}
	function onpointerup(event: PointerEvent) {
		if (swipeFrom === 0 || event.pointerType !== 'touch') return;
		const travel = event.clientY - swipeFrom;
		if (Math.abs(travel) > 70) go(travel < 0 ? 1 : -1);
		swipeFrom = 0;
	}

	/* The card renderer reads the live custom properties off the dialog, so a shared
	 * picture always matches the theme and hue the viewer is actually looking at. */
	async function share(kind: 'scene' | 'poster') {
		if (!dialog || busy) return;
		busy = true;
		message = null;
		try {
			const palette = paletteFrom(dialog);
			const canvas =
				kind === 'poster'
					? await summaryCard(data, palette)
					: await storyCard(scene, data, palette);
			const name = `${data.year}-in-cinema${kind === 'scene' ? `-${scene.id}` : ''}.png`;
			const outcome = await deliver(canvas, name);
			if (outcome === 'saved') message = `Saved as ${name}.`;
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'The picture could not be rendered.';
		} finally {
			busy = false;
		}
	}

	$effect(() => {
		if (scene?.body.kind !== 'summary' || posterPreview || !dialog) return;
		const palette = paletteFrom(dialog);
		summaryCard(data, palette)
			.then((canvas) => (posterPreview = canvas.toDataURL('image/png')))
			.catch(() => (posterPreview = null));
	});

	$effect(() => {
		if (dialog && !dialog.open) dialog.showModal();
		document.documentElement.style.overflow = 'hidden';
		return () => {
			document.documentElement.style.overflow = '';
		};
	});

	function pull(_node: Element, { from }: { from: number }) {
		return {
			duration: reduced ? 0 : 440,
			easing: cubicOut,
			css: (_t: number, u: number) => `transform: translateY(${from * u * 100}%);`
		};
	}
</script>

<svelte:window {onkeydown} />

<dialog
	bind:this={dialog}
	data-hue={scene?.accent ?? 'neutral'}
	class:pulling
	aria-label="{data.year} year in review"
	{onclose}
	{onpointerdown}
	{onpointerup}
>
	<div class="rail top" aria-hidden="true"></div>
	<div class="rail bottom" aria-hidden="true"></div>
	<div class="grain" aria-hidden="true"></div>

	<div class="counter">
		{#each scenes as item, i (item.id)}
			<span class="segment" class:seen={i < index}>
				{#if i === index && !last}
					{#key index}
						<span
							class="tick"
							style="animation-play-state: {playing ? 'running' : 'paused'}"
							onanimationend={() => playing && go(1)}
						></span>
					{/key}
				{:else if i === index}
					<span class="tick held"></span>
				{/if}
			</span>
		{/each}
	</div>

	<button class="close" onclick={() => dialog?.close()} aria-label="Close the year in review">
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<path d="M5 5 19 19M19 5 5 19" fill="none" stroke="currentColor" stroke-width="2" />
		</svg>
	</button>

	<div class="stage">
		{#key index}
			<div class="slide" in:pull={{ from: direction }} out:pull={{ from: -direction }}>
				<Frame {scene}>
					{#snippet poster()}
						<div class="preview">
							{#if posterPreview}
								<img src={posterPreview} alt="Your {data.year} in cinema, as one poster" />
							{:else}
								<p class="rendering">Developing the picture…</p>
							{/if}
						</div>
					{/snippet}
				</Frame>
			</div>
		{/key}
		<div class="flash" aria-hidden="true"></div>
	</div>

	<p class="live" role="status">Frame {index + 1} of {scenes.length}: {scene?.label}</p>

	<div class="controls">
		<button onclick={() => go(-1)} disabled={index === 0} aria-label="Previous frame">
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2" />
			</svg>
		</button>
		<button
			class="play"
			onclick={() => (playing = !playing)}
			aria-pressed={playing}
			disabled={last || reduced}
		>
			{playing ? 'Pause' : 'Play'}
		</button>
		<button class="share" onclick={() => share(last ? 'poster' : 'scene')} disabled={busy}>
			{busy ? 'Rendering…' : last ? 'Save the poster' : 'Share this frame'}
		</button>
		<!-- svelte-ignore a11y_autofocus -->
		<button autofocus onclick={() => go(1)} disabled={last} aria-label="Next frame">
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" />
			</svg>
		</button>
	</div>

	{#if message}
		<p class="message" role="status">{message}</p>
	{/if}
</dialog>

<style>
	dialog {
		width: 100vw;
		max-width: 100vw;
		height: 100dvh;
		max-height: 100dvh;
		margin: 0;
		padding: 0;
		border: none;
		overflow: hidden;
		background: var(--w-ground);
		color: var(--w-type);
		font-family: var(--font-sans);
	}
	dialog::backdrop {
		background: #000;
	}

	/* The gate: every frame sits between two perforated rails, the one shape the
	 * whole deck is built from. */
	.rail {
		position: absolute;
		left: 0;
		right: 0;
		height: 26px;
		background: var(--w-gate);
		pointer-events: none;
	}
	.rail::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 8px;
		height: 10px;
		background-image: repeating-linear-gradient(
			to right,
			var(--w-ground) 0 22px,
			transparent 22px 52px
		);
	}
	.rail.top {
		top: 0;
	}
	.rail.bottom {
		bottom: 0;
	}

	.grain {
		position: absolute;
		inset: 0;
		z-index: 3;
		opacity: 0.055;
		background-image: var(--w-grain);
		background-size: 160px 160px;
		mix-blend-mode: overlay;
		pointer-events: none;
		animation: jitter 640ms steps(4, end) infinite;
	}
	@keyframes jitter {
		0% {
			background-position: 0 0;
		}
		25% {
			background-position: -37px 19px;
		}
		50% {
			background-position: 23px -41px;
		}
		75% {
			background-position: -19px -13px;
		}
	}

	.counter {
		position: absolute;
		top: 34px;
		left: clamp(20px, 6vw, 72px);
		right: clamp(72px, 6vw, 124px);
		z-index: 2;
		display: flex;
		gap: 4px;
	}
	.segment {
		flex: 1;
		height: 3px;
		min-width: 4px;
		background: color-mix(in srgb, var(--w-line) 45%, transparent);
		overflow: hidden;
	}
	.segment.seen {
		background: var(--w-accent);
	}
	.tick {
		display: block;
		height: 100%;
		width: 100%;
		background: var(--w-accent);
		transform-origin: left center;
		animation: tick 6800ms linear forwards;
	}
	.tick.held {
		animation: none;
	}
	@keyframes tick {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	.stage {
		position: absolute;
		inset: 26px 0 76px;
		overflow: hidden;
		touch-action: pan-y;
	}
	.slide {
		position: absolute;
		inset: 0;
	}

	/* The projector: a frame advances with one gate flash, not a fade. */
	.flash {
		position: absolute;
		inset: 0;
		z-index: 4;
		background: var(--w-type);
		opacity: 0;
		pointer-events: none;
	}
	dialog.pulling .flash {
		animation: gate 260ms steps(2, end);
	}
	@keyframes gate {
		0% {
			opacity: 0.16;
		}
		50% {
			opacity: 0.05;
		}
		100% {
			opacity: 0;
		}
	}
	dialog.pulling .stage {
		animation: weave 420ms cubic-bezier(0.3, 0, 0.2, 1);
	}
	@keyframes weave {
		0% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(2px);
		}
		70% {
			transform: translateY(-1px);
		}
		100% {
			transform: translateY(0);
		}
	}

	.preview {
		margin-top: 8px;
		max-width: 300px;
		border: 1px solid var(--w-line);
	}
	.preview img {
		display: block;
		width: 100%;
		height: auto;
	}
	.rendering {
		margin: 0;
		padding: 40px 16px;
		text-align: center;
		font-size: var(--text-sm);
		color: var(--w-muted);
	}

	.live {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.controls {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 26px;
		z-index: 2;
		display: flex;
		align-items: stretch;
		gap: 8px;
		padding: 0 clamp(20px, 6vw, 72px) 12px;
	}
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 44px;
		min-width: 44px;
		padding: 0 14px;
		font: inherit;
		font-size: var(--text-sm);
		color: var(--w-type);
		background: transparent;
		border: 1px solid var(--w-line);
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		color: var(--w-on-accent);
		background: var(--w-accent);
		border-color: var(--w-accent);
	}
	button:disabled {
		color: var(--w-muted);
		border-color: color-mix(in srgb, var(--w-line) 50%, transparent);
		cursor: not-allowed;
	}
	button:focus-visible {
		outline: 2px solid var(--w-accent);
		outline-offset: 2px;
	}
	.share {
		flex: 1;
		font-weight: 700;
		color: var(--w-on-accent);
		background: var(--w-accent);
		border-color: var(--w-accent);
	}
	.share:hover:not(:disabled) {
		filter: brightness(1.12);
	}
	.play {
		min-width: 76px;
	}
	.close {
		position: absolute;
		top: 40px;
		right: clamp(20px, 6vw, 72px);
		z-index: 2;
		min-height: 40px;
		min-width: 40px;
		padding: 0;
		border-color: transparent;
		color: var(--w-muted);
	}

	.message {
		position: absolute;
		bottom: 84px;
		left: clamp(20px, 6vw, 72px);
		z-index: 2;
		margin: 0;
		font-size: var(--text-sm);
		color: var(--w-muted);
	}

	/* The pause control stays on every width: auto-advance without one fails WCAG 2.2.2.
	 * The share button drops to its own row instead. */
	@media (max-width: 560px) {
		.controls {
			flex-wrap: wrap;
			padding: 0 16px 10px;
		}
		.play {
			flex: 1;
		}
		.share {
			order: 5;
			flex-basis: 100%;
		}
		.stage {
			inset: 26px 0 140px;
		}
		.message {
			bottom: 146px;
		}
	}
</style>
