<script lang="ts">
	import { imageUrl } from '$lib/viz/images';
	import type { Poster, Scene } from './scenes';

	let { scene, poster }: { scene: Scene; poster?: import('svelte').Snippet } = $props();

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
	<p class="value" data-kind={scene.valueKind}>{scene.value}</p>
	<h2 class="label">{scene.label}</h2>
	<p class="note">{scene.note}</p>

	{#if scene.body.kind === 'bars'}
		<ul class="bars" class:dense>
			{#each scene.body.bars as bar, i (bar.label + i)}
				<li style="--share: {bar.share}">
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
				<div>
					<dt>{stat.label}</dt>
					<dd data-numeric>{stat.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</article>

<style>
	/* Printed on the slide, not staged on a page: nothing here animates on its own.
	 * The motion belongs to the carousel, which drops this whole frame into the gate. */
	.frame {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: clamp(8px, 1.4cqh, 16px);
		padding: clamp(16px, 5cqw, 60px);
		overflow-y: auto;
		overscroll-behavior: contain;
		color: var(--w-ink);
	}
	/* Anchored low and left, the way a title sits on a slide. Pushing the first child
	 * rather than justifying the box keeps long frames scrollable from their own top. */
	.frame > :first-child {
		margin-top: auto;
	}

	.value {
		margin: 0;
		/* Optical: Mazius is an extra-italic, so the first glyph leans off its own box. */
		margin-left: -0.04em;
		font-family: var(--font-accent);
		font-weight: 400;
		line-height: 0.92;
		color: var(--w-accent);
		text-wrap: balance;
	}
	.value[data-kind='number'] {
		font-size: clamp(2.8rem, 13cqw, 8rem);
	}
	.value[data-kind='name'] {
		font-size: clamp(1.6rem, 7cqw, 4.4rem);
		line-height: 1.02;
	}

	.label {
		margin: 0;
		padding-top: clamp(8px, 1.4cqh, 14px);
		font-family: var(--font-sans);
		font-size: clamp(0.95rem, 2cqw, 1.35rem);
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
		font-size: clamp(0.85rem, 1.7cqw, 1.05rem);
		line-height: var(--leading-normal);
		color: var(--w-muted);
		text-wrap: pretty;
	}

	.bars,
	.posters,
	.stats {
		list-style: none;
		margin: clamp(2px, 0.8cqh, 8px) 0 0;
		padding: 0;
		width: 100%;
	}

	/* Horizontal rows for a handful of named categories. */
	.bars li {
		display: grid;
		grid-template-columns: minmax(6ch, 12ch) minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: clamp(2px, 0.5cqh, 5px) 0;
	}
	.bar-label {
		grid-column: 1;
		font-size: clamp(0.75rem, 1.5cqw, 0.95rem);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bar-track {
		grid-column: 2;
		display: block;
		height: clamp(10px, 1.8cqh, 15px);
		background: rgba(36, 31, 24, 0.12);
	}
	.bar-fill {
		display: block;
		height: 100%;
		width: calc(var(--share) * 100%);
		background: var(--w-accent);
	}
	.bar-value {
		grid-column: 3;
		font-size: clamp(0.75rem, 1.5cqw, 0.95rem);
		color: var(--w-muted);
	}

	/* Twelve months will not carry word labels, so the dense set stands the bars up. */
	.bars.dense {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 4px;
		align-items: end;
		height: clamp(76px, 20cqh, 140px);
	}
	.bars.dense li {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		grid-template-columns: none;
		height: 100%;
		gap: 5px;
		padding: 0;
	}
	.bars.dense .bar-track {
		grid-row: 1;
		grid-column: 1;
		display: flex;
		align-items: flex-end;
		height: 100%;
		background: none;
		border-bottom: 1px solid var(--w-line);
	}
	.bars.dense .bar-fill {
		width: 100%;
		height: calc(var(--share) * 100%);
		min-height: 2px;
	}
	.bars.dense .bar-label {
		grid-row: 2;
		grid-column: 1;
		font-size: clamp(0.6rem, 1.1cqw, 0.75rem);
		text-align: center;
		color: var(--w-muted);
	}
	.bars.dense .bar-value {
		display: none;
	}

	.posters {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: clamp(6px, 1cqw, 12px);
		max-width: min(100%, 58cqw);
	}
	.posters[data-count='1'] {
		max-width: min(100%, 18cqw);
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
		background: rgba(36, 31, 24, 0.1);
		border: 1px solid rgba(36, 31, 24, 0.45);
	}
	.noposter {
		display: grid;
		place-items: center;
		padding: 6px;
		font-size: clamp(0.6rem, 1.1cqw, 0.75rem);
		text-align: center;
		color: var(--w-muted);
	}
	.caption {
		display: block;
		margin-top: 5px;
		font-size: clamp(0.6rem, 1.1cqw, 0.75rem);
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
		gap: 6px clamp(16px, 3cqw, 34px);
		padding-top: clamp(8px, 1.4cqh, 14px);
		border-top: 1px solid var(--w-line);
	}
	.stats dt {
		font-family: var(--font-mono);
		font-size: clamp(0.58rem, 1.05cqw, 0.72rem);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--w-muted);
	}
	.stats dd {
		margin: 2px 0 0;
		font-size: clamp(0.95rem, 1.9cqw, 1.3rem);
		color: var(--w-ink);
	}
</style>
