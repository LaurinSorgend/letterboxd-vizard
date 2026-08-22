<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import Frame from './Frame.svelte';
	import { assemble, buildDeck } from './deck';
	import { deliver, paletteFrom } from './canvas';
	import { storyCard, summaryCard } from './cards';
	import type { Wrapped } from './wrapped';

	let { data, onclose }: { data: Wrapped; onclose: () => void } = $props();

	let expanded = $state(false);
	const deck = $derived(buildDeck(data));
	const scenes = $derived(assemble(deck, expanded));
	const reduced =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let dialog: HTMLDialogElement | null = $state(null);
	let nextButton: HTMLButtonElement | null = $state(null);
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

	/* The card renderer reads the live custom properties off the dialog, so a saved
	 * picture always carries the stock the viewer is actually looking at. */
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

	/* The tray cycles: a slide falls out of the gate and the next one drops in, landing
	 * a shade soft until the lamp house pulls it back into focus. */
	function drop(_node: Element, { from }: { from: number }) {
		return {
			duration: reduced ? 0 : 380,
			easing: cubicOut,
			css: (_t: number, u: number) =>
				`transform: translateY(${-from * u * 115}%); filter: blur(${u * 7}px);`
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
	<!--
		THESIS: a year of films is a carousel tray, not a feed. Refuses the full-bleed
		hero-metric slide: one mounted 35mm transparency, thrown on a screen in a dark room.
		OWN-WORLD: dark room ground, one lit 3:2 gate, aged dye cast per frame, gate dust and
		a hair that never move, stamped mount strip in Fira Code.
		STORY: the viewer sits through their own year, one slide at a time, and takes one home.
		FIRST VIEWPORT: the lit gate centred, the year set large in the upper left of the slide,
		caption rule beneath it, mount strip and tray notches under the gate, controls in the room.
		FORM: Kodak carousel, user-pinned.
	-->
	<button class="close" onclick={() => dialog?.close()} aria-label="Close the year in review">
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<path d="M5 5 19 19M19 5 5 19" fill="none" stroke="currentColor" stroke-width="2" />
		</svg>
	</button>

	<div class="projector">
		<div class="carriage">
			<div class="gate">
				<div class="stage">
					{#key index}
						<div class="slide" in:drop={{ from: direction }} out:drop={{ from: -direction }}>
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
								{#snippet extras()}
									{#if !expanded}
										<button
											class="reveal"
											onclick={() => {
												expanded = true;
												go(1);
												/* The button that was just focused is destroyed with the keyed
												 * slide it lived in, so focus is moved by hand to the control the
												 * viewer would reach for next, rather than left to fall to <body>. */
												nextButton?.focus();
											}}
										>
											Show the other {deck.extras.length} frames
										</button>
									{/if}
								{/snippet}
							</Frame>
						</div>
					{/key}
				</div>
				<div class="cast" aria-hidden="true"></div>
				<div class="grain" aria-hidden="true"></div>
				<div class="vignette" aria-hidden="true"></div>
				<div class="dust" aria-hidden="true"></div>
				<div class="flash" aria-hidden="true"></div>
			</div>

			<div class="mount">
				<span class="stamp">Letterboxd Vizard · {data.year}</span>
				<div class="tray">
					{#each scenes as item, i (item.id)}
						<span class="notch" class:seen={i < index}>
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
				<span class="count" data-numeric>
					{String(index + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}
				</span>
			</div>
		</div>
	</div>

	<p class="live" role="status">Frame {index + 1} of {scenes.length}: {scene?.label}</p>

	<div class="controls">
		<button class="prev" onclick={() => go(-1)} disabled={index === 0} aria-label="Previous frame">
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
		<!-- The gate holds nothing worth saving, but the control keeps its place: a button that
		     leaves the row moves every other control out from under the viewer's thumb. -->
		<button
			class="share"
			onclick={() => share(last ? 'poster' : 'scene')}
			disabled={busy || scene.id === 'more'}
		>
			{busy ? 'Rendering…' : last ? 'Save the slide' : 'Save this frame'}
		</button>
		<!-- svelte-ignore a11y_autofocus -->
		<button
			class="next"
			autofocus
			bind:this={nextButton}
			onclick={() => go(1)}
			disabled={last}
			aria-label="Next frame"
		>
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
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		width: 100vw;
		max-width: 100vw;
		height: 100dvh;
		max-height: 100dvh;
		margin: 0;
		padding: 0;
		border: none;
		overflow: hidden;
		background: var(--w-room);
		color: var(--w-screen);
		font-family: var(--font-sans);
	}
	dialog::backdrop {
		background: #000;
	}
	dialog ::selection {
		color: var(--w-screen);
		background: var(--w-accent);
	}

	.projector {
		display: grid;
		place-items: center;
		min-height: 0;
		padding: clamp(16px, 3vh, 36px) clamp(16px, 4vw, 56px) 0;
	}
	/* The gate is sized off the room, not the other way round: the slide is as large as
	 * the height allows and never taller than it. */
	.carriage {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: min(100%, calc((100dvh - 190px) * 3 / 2));
	}

	/* The slide sizes its own contents: everything inside the gate measures against the
	 * gate, not the window, so a phone gets a whole slide rather than a cropped one. */
	.gate {
		position: relative;
		container-type: size;
		aspect-ratio: 3 / 2;
		overflow: hidden;
		background: var(--w-screen);
		box-shadow: 0 24px 64px -34px #000;
		animation: lamp 5.4s ease-in-out infinite;
	}
	/* A lamp on a transformer is never quite steady. */
	@keyframes lamp {
		0%,
		100% {
			filter: brightness(1);
		}
		37% {
			filter: brightness(1.018);
		}
		62% {
			filter: brightness(0.99);
		}
	}

	.stage {
		position: absolute;
		inset: 0;
		overflow: hidden;
		touch-action: pan-y;
	}
	.slide {
		position: absolute;
		inset: 0;
	}

	/* What the emulsion did with forty years in a shoebox. */
	.cast {
		position: absolute;
		inset: 0;
		z-index: 2;
		background: var(--w-cast);
		pointer-events: none;
	}

	.grain {
		position: absolute;
		inset: 0;
		z-index: 3;
		opacity: 0.14;
		background-image: var(--w-grain);
		background-size: 160px 160px;
		mix-blend-mode: multiply;
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

	/* The lens: hot near the middle, falling away at the corners. */
	.vignette {
		position: absolute;
		inset: 0;
		z-index: 4;
		pointer-events: none;
		background:
			radial-gradient(70% 60% at 50% 42%, rgba(255, 250, 232, 0.14), transparent 72%),
			radial-gradient(122% 112% at 50% 50%, transparent 44%, rgba(24, 16, 6, 0.22) 100%);
	}

	/* Dust and one hair sit on the gate, not on the slide, so they never move between frames. */
	.dust {
		position: absolute;
		inset: 0;
		z-index: 5;
		opacity: 0.45;
		pointer-events: none;
		background-image:
			radial-gradient(circle at 18% 27%, rgba(20, 14, 6, 0.55) 0 1.1px, transparent 1.7px),
			radial-gradient(circle at 74% 16%, rgba(20, 14, 6, 0.4) 0 0.9px, transparent 1.4px),
			radial-gradient(circle at 61% 84%, rgba(20, 14, 6, 0.5) 0 1.3px, transparent 1.9px),
			radial-gradient(circle at 33% 69%, rgba(20, 14, 6, 0.34) 0 0.8px, transparent 1.3px),
			radial-gradient(circle at 88% 57%, rgba(20, 14, 6, 0.45) 0 1px, transparent 1.5px);
	}
	.dust::after {
		content: '';
		position: absolute;
		top: 7%;
		right: 13%;
		width: 1px;
		height: 24%;
		background: linear-gradient(
			to bottom,
			transparent,
			rgba(20, 14, 6, 0.5) 28%,
			rgba(20, 14, 6, 0.32) 74%,
			transparent
		);
		transform: rotate(13deg) skewX(-9deg);
	}

	/* The one authored moment: the tray turns, and for a beat the lamp burns through an
	 * empty gate before the next slide lands. */
	.flash {
		position: absolute;
		inset: 0;
		z-index: 6;
		opacity: 0;
		background: #fffaf0;
		pointer-events: none;
	}
	dialog.pulling .flash {
		animation: blank 380ms ease-out;
	}
	@keyframes blank {
		0% {
			opacity: 0;
		}
		22% {
			opacity: 0.92;
		}
		48% {
			opacity: 0.86;
		}
		100% {
			opacity: 0;
		}
	}

	.mount {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: clamp(12px, 2vw, 24px);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--w-stamp);
	}
	.tray {
		display: flex;
		gap: 3px;
	}
	.notch {
		flex: 1;
		min-width: 3px;
		height: 8px;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgba(140, 129, 114, 0.5);
	}
	.notch.seen {
		background: var(--w-stamp);
		box-shadow: none;
	}
	.tick {
		display: block;
		width: 100%;
		height: 100%;
		background: var(--w-screen);
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
	}
	.count {
		color: var(--w-screen);
	}

	.reveal {
		margin-top: clamp(8px, 1.4cqh, 14px);
		padding: 10px 18px;
		font: inherit;
		font-size: clamp(0.8rem, 1.6cqw, 1rem);
		color: var(--w-ink);
		background: none;
		border: 1px solid var(--w-accent);
		cursor: pointer;
	}
	.reveal:hover {
		color: var(--w-accent);
	}
	.reveal:focus-visible {
		outline: 2px solid var(--w-accent);
		outline-offset: 3px;
	}

	.preview {
		margin-top: 6px;
		max-width: clamp(150px, 26cqw, 300px);
		border: 1px solid var(--w-line);
	}
	.preview img {
		display: block;
		width: 100%;
		height: auto;
	}
	.rendering {
		margin: 0;
		padding: 28px 16px;
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

	/* Every control keeps its own column, so the gate frame dropping the save button leaves a
	 * hole rather than sliding Next halfway across the room mid-run. */
	.controls {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto;
		gap: 8px;
		padding: clamp(12px, 2vh, 20px) clamp(16px, 4vw, 56px) clamp(16px, 3vh, 28px);
	}
	.prev {
		grid-column: 1;
	}
	.play {
		grid-column: 2;
	}
	.share {
		grid-column: 3;
	}
	.next {
		grid-column: 4;
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
		color: var(--w-screen);
		background: transparent;
		border: 1px solid rgba(140, 129, 114, 0.5);
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		color: var(--w-room);
		background: var(--w-screen);
		border-color: var(--w-screen);
	}
	button:disabled {
		color: #6f6656;
		border-color: rgba(140, 129, 114, 0.24);
		cursor: not-allowed;
	}
	button:focus-visible {
		outline: 2px solid var(--w-screen);
		outline-offset: 2px;
	}
	.share {
		font-weight: 700;
		color: var(--w-room);
		background: var(--w-screen);
		border-color: var(--w-screen);
	}
	.share:hover:not(:disabled) {
		filter: brightness(0.93);
	}
	.play {
		min-width: 76px;
	}
	.close {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 2;
		min-height: 40px;
		min-width: 40px;
		padding: 0;
		color: var(--w-stamp);
		border-color: transparent;
	}

	.message {
		position: absolute;
		left: clamp(16px, 4vw, 56px);
		bottom: 100px;
		margin: 0;
		font-size: var(--text-sm);
		color: var(--w-stamp);
	}

	/* Portrait mounts are as real as landscape ones, and a phone has no room for 3:2.
	 * The pause control stays at every width: auto-advance without one fails WCAG 2.2.2. */
	@media (max-width: 640px) {
		.carriage {
			width: min(100%, calc((100dvh - 250px) * 2 / 3));
		}
		.gate {
			aspect-ratio: 2 / 3;
		}
		/* No room on the mount for the full stamp; the tray and the count carry it. */
		.stamp {
			display: none;
		}
		.mount {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.controls {
			grid-template-columns: auto minmax(0, 1fr) auto;
			padding: 12px 16px 16px;
		}
		.prev,
		.play,
		.next {
			grid-row: 1;
		}
		.next {
			grid-column: 3;
		}
		.share {
			grid-row: 2;
			grid-column: 1 / -1;
		}
		.message {
			bottom: 152px;
		}
	}
</style>
