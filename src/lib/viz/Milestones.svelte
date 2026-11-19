<script lang="ts">
	import { imageUrl, webHref } from '$lib/film/links';
	import { formatShort } from '$lib/format';
	import type { Milestone } from './milestones';
	import { pager } from './pager.svelte';
	import ShowMore from './ShowMore.svelte';

	const LIMIT = 12;

	let { milestones }: { milestones: Milestone[] } = $props();

	const paging = pager(
		() => milestones.length,
		() => LIMIT
	);
	const rows = $derived(milestones.slice(0, paging.shown));
</script>

<ol class="timeline">
	{#each rows as m, i (m.date + m.eyebrow)}
		{@const href = webHref(m.film.uri)}
		{@const src = imageUrl(m.film.tmdb?.posterPath ?? null, 'w92')}
		<li class="entry" class:right={i % 2 === 1}>
			<span class="dot" aria-hidden="true"></span>
			<div class="card">
				<span class="pic">
					{#if src}
						<img {src} alt="" loading="lazy" width="40" height="60" />
					{/if}
				</span>
				<div class="text">
					<span class="eyebrow">{m.eyebrow}</span>
					{#if href}
						<a class="film" {href} target="_blank" rel="noopener">{m.film.name}</a>
					{:else}
						<span class="film">{m.film.name}</span>
					{/if}
					<span class="detail" data-numeric
						>{m.dateLabel ?? formatShort(m.date)}{m.detail ? ` · ${m.detail}` : ''}</span
					>
				</div>
			</div>
		</li>
	{/each}
</ol>
<ShowMore pager={paging} />

<style>
	.timeline {
		position: relative;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.timeline::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--border);
	}
	.entry {
		position: relative;
		width: calc(50% - 24px);
		padding: 10px 0;
	}
	.entry:not(:first-child) {
		margin-top: -40px;
	}
	.entry:not(.right) {
		margin-right: auto;
		padding-right: 24px;
	}
	.entry.right {
		margin-left: auto;
		padding-left: 24px;
	}
	.dot {
		position: absolute;
		top: 24px;
		width: 8px;
		height: 8px;
		background: var(--accent);
	}
	.entry:not(.right) .dot {
		right: -4px;
	}
	.entry.right .dot {
		left: -4px;
	}
	.card {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.entry:not(.right) .card {
		flex-direction: row-reverse;
	}
	.pic {
		flex-shrink: 0;
		width: 40px;
		aspect-ratio: 2 / 3;
	}
	.pic img {
		display: block;
		width: 40px;
		height: auto;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		background: var(--bg-secondary);
	}
	.text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.entry:not(.right) .text {
		align-items: flex-end;
		text-align: right;
	}
	.eyebrow {
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.film {
		font-size: var(--text-base);
		color: var(--fg);
		text-decoration: none;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a.film:hover {
		text-decoration: underline;
		color: var(--accent);
	}
	.detail {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	@media (max-width: 640px) {
		.timeline::before {
			left: 16px;
		}
		.entry,
		.entry.right {
			width: auto;
			margin: 0;
			padding: 10px 0 10px 32px;
		}
		.entry:not(:first-child) {
			margin-top: 0;
		}
		.entry:not(.right) .card {
			flex-direction: row;
		}
		.entry:not(.right) .text {
			align-items: flex-start;
			text-align: left;
		}
		.dot,
		.entry.right .dot {
			left: 12px;
			right: auto;
		}
		.pic,
		.pic img {
			width: 32px;
		}
	}
</style>
