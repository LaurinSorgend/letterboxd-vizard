<script lang="ts">
	import { imageUrl } from '$lib/viz/images';
	import type { Poster, Scene } from './scenes';

	let { scene, poster }: { scene: Scene; poster?: import('svelte').Snippet } = $props();

	/* Split for the reveal: each glyph wipes up from its own baseline, staggered, so a
	 * number lands like a counter rolling to a stop rather than fading in as one block. */
	const glyphs = $derived([...scene.value].map((char) => (char === ' ' ? ' ' : char)));
	const dense = $derived(scene.body.kind === 'bars' && scene.body.bars.length > 6);
</script>

{#snippet posterCard(item: Poster, size: 'w185' | 'w342')}
	{@const src = imageUrl(item.path, size)}
	<li>
		<svelte:element
			this={item.href ? 'a' : 'span'}
			href={item.href ?? undefined}
			target={item.href ? '_blank' : undefined}
			rel={item.href ? 'noopener' : undefined}
		>
			{#if src}
				<img {src} alt={item.name} />
			{:else}
				<span class="noposter">{item.name}</span>
			{/if}
			<span class="caption">
				<span class="caption-name">{item.name}</span>
				{#if item.meta}<span class="caption-meta" data-numeric>{item.meta}</span>{/if}
			</span>
		</svelte:element>
	</li>
{/snippet}

<article class="frame" aria-label={scene.label}>
	<p class="value" data-kind={scene.valueKind}>
		{#each glyphs as glyph, i (i)}<span style="--i: {i}">{glyph}</span>{/each}
	</p>
	<h2 class="label">{scene.label}</h2>
	<p class="note">{scene.note}</p>

	{#if scene.body.kind === 'bars'}
		<ul class="bars" class:dense>
			{#each scene.body.bars as bar, i (bar.label + i)}
				<li style="--share: {bar.share}; --i: {i}">
					<span class="bar-track"><span class="bar-fill"></span></span>
					<span class="bar-label">{bar.label}</span>
					<span class="bar-value" data-numeric>{bar.value}</span>
				</li>
			{/each}
		</ul>
	{:else if scene.body.kind === 'posters'}
		<ul class="posters" data-count={scene.body.posters.length}>
			{#each scene.body.posters as item, i (item.name + i)}
				{@render posterCard(item, scene.body.posters.length === 1 ? 'w342' : 'w185')}
			{/each}
		</ul>
	{:else if scene.body.kind === 'summary' && poster}
		{@render poster()}
	{/if}

	{#if scene.stats.length > 0}
		<dl class="stats">
			{#each scene.stats as stat, i (stat.label + i)}
				<div style="--i: {i}">
					<dt>{stat.label}</dt>
					<dd data-numeric>{stat.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</article>

<style>
	.frame {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		gap: 12px;
		padding: 72px clamp(20px, 6vw, 72px) 96px;
		overflow-y: auto;
		overscroll-behavior: contain;
		color: var(--w-type);
	}

	/* Every child of the cascade shares one timing family: the frame settles once,
	 * top to bottom, instead of each element staging its own entrance. */
	.value,
	.label,
	.note,
	.bars,
	.posters,
	.stats {
		animation: settle 460ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
	}
	.label {
		animation-delay: 180ms;
	}
	.note {
		animation-delay: 240ms;
	}
	.bars,
	.posters {
		animation-delay: 300ms;
	}
	.stats {
		animation-delay: 360ms;
	}

	@keyframes settle {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}

	.value {
		font-family: var(--font-accent);
		font-weight: 400;
		line-height: 0.92;
		margin: 0;
		color: var(--w-accent);
		/* Optical: Mazius is an extra-italic, so the first glyph leans off its own box. */
		margin-left: -0.04em;
		text-wrap: balance;
	}
	.value[data-kind='number'] {
		font-size: clamp(var(--text-4xl), 15vw, 8rem);
	}
	.value[data-kind='name'] {
		font-size: clamp(var(--text-3xl), 8vw, 4.5rem);
		line-height: 1.02;
	}
	.value span {
		display: inline-block;
		animation: roll 520ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
		animation-delay: calc(var(--i) * 34ms);
	}
	@keyframes roll {
		from {
			clip-path: inset(100% 0 -20% 0);
			transform: translateY(0.28em);
		}
		to {
			clip-path: inset(-25% 0 -20% 0);
			transform: translateY(0);
		}
	}

	.label {
		margin: 6px 0 0;
		padding-top: 14px;
		font-family: var(--font-sans);
		font-size: var(--text-lg);
		font-weight: 700;
		line-height: var(--leading-snug);
		letter-spacing: 0.01em;
		border-top: 2px solid var(--w-accent);
		/* The rule reads as the caption line under a still: it belongs to the value above. */
		min-width: min(100%, 22ch);
	}

	.note {
		margin: 0;
		max-width: 46ch;
		font-size: var(--text-base);
		line-height: var(--leading-normal);
		color: var(--w-muted);
		text-wrap: pretty;
	}

	.bars,
	.posters,
	.stats {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		width: 100%;
	}

	/* Horizontal rows for a handful of named categories. */
	.bars li {
		display: grid;
		grid-template-columns: minmax(6ch, 12ch) minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: 5px 0;
	}
	.bar-label {
		grid-column: 1;
		font-size: var(--text-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bar-track {
		grid-column: 2;
		display: block;
		height: 14px;
		background: color-mix(in srgb, var(--w-line) 30%, transparent);
	}
	.bar-fill {
		display: block;
		height: 100%;
		background: var(--w-accent);
		transform-origin: left center;
		animation: grow 620ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
		animation-delay: calc(340ms + var(--i) * 45ms);
		width: calc(var(--share) * 100%);
	}
	.bar-value {
		grid-column: 3;
		font-size: var(--text-sm);
		color: var(--w-muted);
	}
	@keyframes grow {
		from {
			transform: scaleX(0);
		}
	}

	/* Twelve months will not carry word labels, so the dense set stands the bars up. */
	.bars.dense {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 4px;
		align-items: end;
		height: 132px;
	}
	.bars.dense li {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		grid-template-columns: none;
		height: 100%;
		gap: 6px;
		padding: 0;
	}
	.bars.dense .bar-track {
		grid-row: 1;
		grid-column: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
		background: none;
		border-bottom: 1px solid var(--w-line);
	}
	.bars.dense .bar-fill {
		width: 100%;
		height: calc(var(--share) * 100%);
		min-height: 2px;
		transform-origin: bottom center;
		animation-name: grow-up;
	}
	.bars.dense .bar-label {
		grid-row: 2;
		grid-column: 1;
		font-size: var(--text-2xs);
		text-align: center;
		color: var(--w-muted);
	}
	.bars.dense .bar-value {
		display: none;
	}
	@keyframes grow-up {
		from {
			transform: scaleY(0);
		}
	}

	.posters {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: 10px;
		max-width: 620px;
	}
	.posters[data-count='1'] {
		max-width: 200px;
	}
	.posters a,
	.posters span:not(.noposter) {
		display: block;
		text-decoration: none;
		color: inherit;
	}
	.posters img,
	.noposter {
		display: block;
		width: 100%;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		background: var(--w-gate);
		border: 1px solid var(--w-line);
	}
	.noposter {
		display: grid;
		place-items: center;
		padding: 6px;
		font-size: var(--text-2xs);
		text-align: center;
		color: var(--w-muted);
	}
	.caption {
		display: block;
		margin-top: 6px;
		font-size: var(--text-2xs);
		line-height: var(--leading-snug);
	}
	.caption-name {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		color: var(--w-muted);
	}
	.caption-meta {
		display: block;
		color: var(--w-accent);
	}
	.posters a:focus-visible {
		outline: 2px solid var(--w-accent);
		outline-offset: 3px;
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 28px;
		padding-top: 14px;
		border-top: 1px solid var(--w-line);
	}
	.stats dt {
		font-size: var(--text-2xs);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--w-muted);
	}
	.stats dd {
		margin: 2px 0 0;
		font-size: var(--text-lg);
		color: var(--w-type);
	}

	@media (max-width: 560px) {
		.frame {
			padding: 64px 20px 104px;
			gap: 10px;
		}
		.posters {
			max-width: none;
		}
		.stats {
			gap: 6px 20px;
		}
		.stats dd {
			font-size: var(--text-base);
		}
	}
</style>
