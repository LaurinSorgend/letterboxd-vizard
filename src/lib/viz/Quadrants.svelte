<script lang="ts">
	import {
		excludedCount,
		hiddenGems,
		quadrantPoints,
		quadrantSummaries,
		type QuadrantPoint
	} from './quadrants';
	import { webHref } from './href';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const MARGIN = { top: 12, right: 12, bottom: 34, left: 40 };
	/** How close the pointer must come, in screen pixels, before a point claims the tooltip. */
	const HOVER_REACH = 22;
	const Y_MIN = 0.25;
	const Y_MAX = 5.25;

	let wrapper: HTMLElement | undefined = $state();
	let width = $state(0);
	let hover: QuadrantPoint | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0 });

	const height = $derived(Math.min(460, Math.max(280, width * 0.55)));
	const result = $derived(quadrantPoints(films));
	const points = $derived(result.points);
	const axes = $derived(result.axes);
	const dropped = $derived(excludedCount(films));
	const gems = $derived(hiddenGems(points));
	const summaries = $derived(quadrantSummaries(points));

	/* Spread as a loop, not Math.max(...points): a large library would overflow the argument list. */
	const extent = $derived.by(() => {
		let min = Infinity;
		let max = -Infinity;
		for (const p of points) {
			if (p.popularity < min) min = p.popularity;
			if (p.popularity > max) max = p.popularity;
		}
		return points.length > 0 ? { min, max } : { min: 1, max: 10 };
	});

	/* Vote counts span orders of magnitude, so the x-axis works in log10 decades. */
	const domain = $derived.by(() => {
		const min = Math.floor(Math.log10(Math.max(1, extent.min)));
		const max = Math.max(Math.ceil(Math.log10(Math.max(1, extent.max))), min + 1);
		return { min, max };
	});

	const plot = $derived({
		w: Math.max(1, width - MARGIN.left - MARGIN.right),
		h: Math.max(1, height - MARGIN.top - MARGIN.bottom)
	});

	function px(popularity: number): number {
		const span = domain.max - domain.min || 1;
		return MARGIN.left + ((Math.log10(Math.max(1, popularity)) - domain.min) / span) * plot.w;
	}

	function py(rating: number): number {
		return MARGIN.top + ((Y_MAX - rating) / (Y_MAX - Y_MIN)) * plot.h;
	}

	const xTicks = $derived.by(() => {
		const ticks: number[] = [];
		for (let decade = domain.min; decade <= domain.max; decade++) ticks.push(10 ** decade);
		return ticks;
	});
	const yTicks = [1, 2, 3, 4, 5];

	const medianX = $derived(px(axes.popularityMedian));
	const thresholdY = $derived(py(axes.ratingThreshold));

	function onMove(event: PointerEvent) {
		if (!wrapper) return;
		const box = wrapper.getBoundingClientRect();
		const x = event.clientX - box.left;
		const y = event.clientY - box.top;
		let best: QuadrantPoint | null = null;
		let bestDistance = HOVER_REACH;
		for (const p of points) {
			const distance = Math.hypot(px(p.popularity) - x, py(p.rating + p.jitter) - y);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = p;
			}
		}
		hover = best;
		if (best) {
			hoverPos = {
				x: Math.min(px(best.popularity) + 12, Math.max(0, box.width - 200)),
				y: py(best.rating + best.jitter) + 12
			};
		}
	}

	/** "12k" style label; TMDB vote counts never reach a range where "M" would be needed. */
	function formatPopularity(count: number): string {
		return count >= 1000 ? `${count / 1000}k` : String(count);
	}

	const summary = $derived(
		points.length > 0
			? `${points.length} rated films split at a popularity median of ` +
					`${axes.popularityMedian.toLocaleString('en')} combined TMDB + IMDb votes, and at ` +
					`${axes.ratingThreshold}★ for loved vs. not.`
			: 'Not enough rated, vote-matched films to plot.'
	);
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
			{#each xTicks as count (count)}
				<text
					class="tick"
					data-numeric
					x={px(count)}
					y={height - MARGIN.bottom + 16}
					text-anchor="middle"
				>
					{formatPopularity(count)}
				</text>
			{/each}
			<text
				class="axis-label"
				x={(MARGIN.left + width - MARGIN.right) / 2}
				y={height - 4}
				text-anchor="middle"
			>
				TMDB + IMDb vote count (log scale)
			</text>

			<line class="median" x1={medianX} x2={medianX} y1={MARGIN.top} y2={py(Y_MIN)} />
			<line
				class="median"
				x1={MARGIN.left}
				x2={width - MARGIN.right}
				y1={thresholdY}
				y2={thresholdY}
			/>

			<text class="quadrant-label" x={MARGIN.left + 6} y={MARGIN.top + 14}>Hidden gems</text>
			<text
				class="quadrant-label"
				x={width - MARGIN.right - 6}
				y={MARGIN.top + 14}
				text-anchor="end"
			>
				Popular favorites
			</text>
			<text class="quadrant-label" x={MARGIN.left + 6} y={py(Y_MIN) - 8}>
				Skippable obscurities
			</text>
			<text class="quadrant-label" x={width - MARGIN.right - 6} y={py(Y_MIN) - 8} text-anchor="end">
				Popular, not for you
			</text>

			{#each points as point (point.film.uri)}
				<circle class="dot" cx={px(point.popularity)} cy={py(point.rating + point.jitter)} r="4" />
			{/each}

			{#if hover}
				<circle
					class="dot active"
					cx={px(hover.popularity)}
					cy={py(hover.rating + hover.jitter)}
					r="6"
				/>
			{/if}
		</svg>

		{#if hover}
			<div class="tooltip" style="left: {hoverPos.x}px; top: {hoverPos.y}px">
				<strong>{hover.film.name}</strong>
				<div>
					<span data-numeric>★ {hover.rating}</span>
					· <span data-numeric>{hover.popularity.toLocaleString('en')} votes</span>
					{#if hover.film.tmdb?.year}
						· <span data-numeric>{hover.film.tmdb.year}</span>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<p class="readout">{summary}</p>
<p class="note">
	Popularity is TMDB's vote count plus IMDb's, a stand-in for how widely a film has been seen; rated
	films without either are left out.
	{#if dropped > 0}
		{dropped} rated films left out for that reason.
	{/if}
	Points are nudged vertically so equal ratings stay countable.
</p>

{#if gems.length > 0}
	<div class="gems">
		<h3>Your hidden gems</h3>
		<p class="sub">
			Rated {axes.ratingThreshold}★ or higher, seen by fewer people than most of your library.
		</p>
		<ul>
			{#each gems as gem (gem.film.uri)}
				<li>
					<a
						class="name"
						href={webHref(gem.film.uri) ?? undefined}
						target="_blank"
						rel="noopener"
						title={gem.film.name}
					>
						{gem.film.name}
					</a>
					<span class="nums" data-numeric>
						★ <strong>{gem.rating}</strong> · {gem.popularity.toLocaleString('en')} votes
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<details>
	<summary>View as table</summary>
	<table>
		<thead>
			<tr><th>Quadrant</th><th class="num">Films</th><th class="num">Avg rating</th></tr>
		</thead>
		<tbody>
			{#each summaries as row (row.quadrant)}
				<tr>
					<td>{row.label}</td>
					<td class="num" data-numeric>{row.count}</td>
					<td class="num" data-numeric>{row.avgRating !== null ? row.avgRating.toFixed(2) : '—'}</td
					>
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
	.median {
		stroke: var(--border-strong);
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
	}
	.tick {
		fill: var(--fg-muted);
		font-size: var(--text-2xs);
	}
	.axis-label {
		fill: var(--fg-secondary);
		font-size: var(--text-2xs);
	}
	.quadrant-label {
		fill: var(--fg-muted);
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
	.gems {
		margin-top: 16px;
	}
	.gems h3 {
		margin: 0 0 4px;
	}
	.gems .sub {
		margin: 0 0 8px;
		color: var(--fg-secondary);
		font-size: var(--text-sm);
	}
	.gems ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.gems li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--accent);
		text-decoration: none;
	}
	.name:hover {
		text-decoration: underline;
	}
	.nums {
		color: var(--fg-secondary);
		white-space: nowrap;
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
