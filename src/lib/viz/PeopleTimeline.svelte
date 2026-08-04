<script lang="ts">
	import { formatShort } from './milestones';
	import {
		buildSeries,
		defaultSelectionKeys,
		MAX_SELECTED,
		personOptions,
		type PersonOption,
		type PersonSeries,
		type SeriesPoint
	} from './peopleTimeline';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const MARGIN = { top: 12, right: 12, bottom: 34, left: 40 };
	/** How close the pointer must come, in screen pixels, before a point claims the tooltip. */
	const HOVER_REACH = 22;
	/** Candidate x-axis steps in years; the first that keeps the axis under ten ticks wins. */
	const YEAR_STEPS = [1, 2, 5, 10, 20, 25];
	/** Candidate y-axis steps in hours, same idea. */
	const HOUR_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
	const SEARCH_LIMIT = 40;

	let wrapper: HTMLElement | undefined = $state();
	let width = $state(0);
	let search = $state('');
	let selectedKeys: string[] = $state([]);
	let seeded = false;
	let hover: { series: PersonSeries; point: SeriesPoint } | null = $state(null);
	let hoverPos = $state({ x: 0, y: 0 });

	const height = $derived(Math.min(420, Math.max(280, width * 0.5)));
	const options = $derived(personOptions(films));

	/* Seeds the default top-2/top-2 selection once options first exist, same one-shot idea as
	   reading page.url.searchParams once on mount rather than re-deriving on every change. */
	$effect(() => {
		if (!seeded && options.length > 0) {
			selectedKeys = defaultSelectionKeys(films);
			seeded = true;
		}
	});

	const matches = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
	});
	const listRows = $derived(matches.slice(0, SEARCH_LIMIT));
	const listOverflow = $derived(Math.max(0, matches.length - SEARCH_LIMIT));

	const selected = $derived(
		selectedKeys
			.map((key) => options.find((o) => o.key === key))
			.filter((o): o is PersonOption => o !== undefined)
	);
	const series = $derived(selected.map((option) => buildSeries(option)));
	const atCap = $derived(selectedKeys.length >= MAX_SELECTED);
	const excludedTotal = $derived(series.reduce((sum, s) => sum + s.excluded, 0));

	function toggle(key: string) {
		if (selectedKeys.includes(key)) {
			selectedKeys = selectedKeys.filter((k) => k !== key);
		} else if (!atCap) {
			selectedKeys = [...selectedKeys, key];
		}
	}

	const allPoints = $derived(
		series.flatMap((s) => s.points.map((point) => ({ series: s, point })))
	);

	/** Frozen once, not re-read per render: a line that only ever extends by re-deriving `now`
	    would keep nudging the axis on every reactive pass. */
	const now = Date.now();

	/* Spread as a loop, not Math.max(...points): a large library would overflow the argument list.
	   Max always includes `now`, so the axis runs through to today even when the most recent
	   watch was a while ago, rather than stopping cold at the last plotted point. */
	const dateExtent = $derived.by(() => {
		let min = Infinity;
		let max = now;
		for (const { point } of allPoints) {
			const t = Date.parse(point.date);
			if (t < min) min = t;
			if (t > max) max = t;
		}
		return allPoints.length > 0 ? { min, max } : { min: 0, max: 0 };
	});

	const yearExtent = $derived(
		allPoints.length === 0
			? { min: 0, max: 1 }
			: {
					min: new Date(dateExtent.min).getUTCFullYear(),
					max: new Date(dateExtent.max).getUTCFullYear()
				}
	);

	const yearStep = $derived(
		YEAR_STEPS.find((s) => (yearExtent.max - yearExtent.min) / s <= 9) ??
			YEAR_STEPS[YEAR_STEPS.length - 1]
	);

	const yearDomain = $derived({
		min: Math.floor(yearExtent.min / yearStep) * yearStep,
		max: Math.max(
			Math.ceil(yearExtent.max / yearStep) * yearStep,
			Math.floor(yearExtent.min / yearStep) * yearStep + yearStep
		)
	});

	const timeDomain = $derived({
		min: Date.UTC(yearDomain.min, 0, 1),
		max: Date.UTC(yearDomain.max, 0, 1)
	});

	const maxHours = $derived(
		series.reduce((max, s) => Math.max(max, s.points[s.points.length - 1]?.cumulativeHours ?? 0), 0)
	);

	const hourStep = $derived(
		HOUR_STEPS.find((s) => maxHours / s <= 9) ?? HOUR_STEPS[HOUR_STEPS.length - 1]
	);

	const hourDomain = $derived(Math.max(hourStep, Math.ceil(maxHours / hourStep) * hourStep));

	const plot = $derived({
		w: Math.max(1, width - MARGIN.left - MARGIN.right),
		h: Math.max(1, height - MARGIN.top - MARGIN.bottom)
	});

	function pxMs(ms: number): number {
		const span = timeDomain.max - timeDomain.min || 1;
		return MARGIN.left + ((ms - timeDomain.min) / span) * plot.w;
	}

	function px(date: string): number {
		return pxMs(Date.parse(date));
	}

	function py(hours: number): number {
		return MARGIN.top + ((hourDomain - hours) / hourDomain) * plot.h;
	}

	const yearTicks = $derived.by(() => {
		const ticks: number[] = [];
		for (let y = yearDomain.min; y <= yearDomain.max; y += yearStep) ticks.push(y);
		return ticks;
	});

	const hourTicks = $derived.by(() => {
		const ticks: number[] = [];
		for (let h = 0; h <= hourDomain; h += hourStep) ticks.push(h);
		return ticks;
	});

	/**
	 * Step-after: the total holds flat at its old value right up to the moment of the next watch,
	 * then jumps — an honest picture of a running total, rather than a diagonal implying gradual
	 * viewing between two dates that were often months apart. Extended flat to today at the end,
	 * matching the domain's own extension past the last watch (see `dateExtent` above).
	 */
	function pathFor(s: PersonSeries): string {
		const points = s.points;
		if (points.length === 0) return '';
		const first = points[0];
		let d = `M${px(first.date).toFixed(1)},${py(first.cumulativeHours).toFixed(1)}`;
		for (let i = 1; i < points.length; i++) {
			const x = px(points[i].date).toFixed(1);
			const heldY = py(points[i - 1].cumulativeHours).toFixed(1);
			const y = py(points[i].cumulativeHours).toFixed(1);
			d += ` L${x},${heldY} L${x},${y}`;
		}
		const last = points[points.length - 1];
		d += ` L${pxMs(now).toFixed(1)},${py(last.cumulativeHours).toFixed(1)}`;
		return d;
	}

	function onMove(event: PointerEvent) {
		if (!wrapper) return;
		const box = wrapper.getBoundingClientRect();
		const x = event.clientX - box.left;
		const y = event.clientY - box.top;
		let best: { series: PersonSeries; point: SeriesPoint } | null = null;
		let bestDistance = HOVER_REACH;
		for (const candidate of allPoints) {
			const distance = Math.hypot(
				px(candidate.point.date) - x,
				py(candidate.point.cumulativeHours) - y
			);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = candidate;
			}
		}
		hover = best;
		if (best) {
			hoverPos = {
				x: Math.min(px(best.point.date) + 12, Math.max(0, box.width - 200)),
				y: py(best.point.cumulativeHours) + 12
			};
		}
	}

	function formatHours(hours: number): string {
		return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
	}

	const PALETTE = [
		'--ctp-mauve',
		'--ctp-teal',
		'--ctp-sapphire',
		'--ctp-maroon',
		'--ctp-peach',
		'--ctp-flamingo',
		'--ctp-sky',
		'--ctp-rosewater',
		'--ctp-pink',
		'--ctp-teal',
		'--ctp-sky',
		'--ctp-blue',
		'--ctp-lavender',
	];

	function colorVar(index: number): string {
		return `var(${PALETTE[index % PALETTE.length]})`;
	}
</script>

<div class="picker">
	<label class="search-label" for="ptl-search">Search actors and directors</label>
	<input id="ptl-search" type="text" placeholder="Type a name…" bind:value={search} />

	{#if selected.length > 0}
		<ul class="chips">
			{#each series as s, i (s.option.key)}
				<li class="chip">
					<span class="dot" style="background: {colorVar(i)}" aria-hidden="true"></span>
					{#if s.option.href}
						<a href={s.option.href} target="_blank" rel="noopener">{s.option.name}</a>
					{:else}
						<span>{s.option.name}</span>
					{/if}
					<span class="role">{s.option.role}</span>
					<button
						type="button"
						aria-label="Remove {s.option.name}"
						onclick={() => toggle(s.option.key)}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if atCap}
		<p class="note">Up to {MAX_SELECTED} people at a time — remove one to add another.</p>
	{/if}

	<ul class="options" role="group" aria-label="Actors and directors">
		{#each listRows as option (option.key)}
			<li>
				<label class:disabled={!selectedKeys.includes(option.key) && atCap}>
					<input
						type="checkbox"
						checked={selectedKeys.includes(option.key)}
						disabled={!selectedKeys.includes(option.key) && atCap}
						onchange={() => toggle(option.key)}
					/>
					<span class="name">{option.name}</span>
					<span class="meta" data-numeric
						>{option.role} · {option.count} film{option.count === 1 ? '' : 's'}</span
					>
				</label>
			</li>
		{:else}
			<li class="empty">No match.</li>
		{/each}
	</ul>
	{#if listOverflow > 0}
		<p class="note">{listOverflow} more — refine your search.</p>
	{/if}
</div>

{#if series.length === 0}
	<p class="empty-chart">Select at least one actor or director above to plot their watch time.</p>
{:else if allPoints.length === 0}
	<p class="empty-chart">None of the selected people's films have a known runtime to plot.</p>
{:else}
	<div class="wrap" bind:this={wrapper} bind:clientWidth={width}>
		{#if width > 0}
			<svg
				{width}
				{height}
				viewBox="0 0 {width} {height}"
				role="img"
				aria-label="Cumulative hours watched over time for {series
					.map((s) => s.option.name)
					.join(', ')}"
				onpointermove={onMove}
				onpointerleave={() => (hover = null)}
			>
				{#each hourTicks as h (h)}
					<line class="grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={py(h)} y2={py(h)} />
					<text
						class="tick"
						data-numeric
						x={MARGIN.left - 6}
						y={py(h)}
						text-anchor="end"
						dy="0.32em"
					>
						{h}h
					</text>
				{/each}

				<line class="axis" x1={MARGIN.left} x2={width - MARGIN.right} y1={py(0)} y2={py(0)} />
				{#each yearTicks as y (y)}
					<text
						class="tick"
						data-numeric
						x={px(`${y}-01-01`)}
						y={height - MARGIN.bottom + 16}
						text-anchor="middle"
					>
						{y}
					</text>
				{/each}
				<text
					class="axis-label"
					x={(MARGIN.left + width - MARGIN.right) / 2}
					y={height - 4}
					text-anchor="middle"
				>
					Year
				</text>

				{#each series as s, i (s.option.key)}
					{#if s.points.length > 0}
						<path class="line" d={pathFor(s)} style="stroke: {colorVar(i)}" />
						{@const last = s.points[s.points.length - 1]}
						<circle
							class="end"
							cx={px(last.date)}
							cy={py(last.cumulativeHours)}
							r="4"
							style="fill: {colorVar(i)}"
						/>
					{/if}
				{/each}

				{#if hover}
					{@const i = series.indexOf(hover.series)}
					<circle
						class="dot active"
						cx={px(hover.point.date)}
						cy={py(hover.point.cumulativeHours)}
						r="5"
						style="fill: {colorVar(i)}"
					/>
				{/if}
			</svg>

			{#if hover}
				<div class="tooltip" style="left: {hoverPos.x}px; top: {hoverPos.y}px">
					<strong>{hover.series.option.name}</strong>
					<div>{hover.point.event.film.name}</div>
					<div data-numeric>
						{formatShort(hover.point.date)} · {formatHours(hover.point.cumulativeHours)} total
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<p class="note">
		Cumulative hours watched of each person's films, across every diary date — rewatches count
		again.
		{#if excludedTotal > 0}
			{excludedTotal} diary entries left out for want of a known runtime.
		{/if}
	</p>

	<details>
		<summary>View as table</summary>
		<table>
			<thead>
				<tr>
					<th>Person</th>
					<th>Role</th>
					<th class="num">Events plotted</th>
					<th class="num">Total hours</th>
				</tr>
			</thead>
			<tbody>
				{#each series as s (s.option.key)}
					<tr>
						<td>{s.option.name}</td>
						<td>{s.option.role}</td>
						<td class="num" data-numeric>{s.points.length}</td>
						<td class="num" data-numeric
							>{formatHours(s.points[s.points.length - 1]?.cumulativeHours ?? 0)}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
{/if}

<style>
	.picker {
		margin-bottom: 16px;
	}
	.search-label {
		display: block;
		margin-bottom: 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	input[type='text'] {
		width: 100%;
		max-width: 360px;
		padding: 6px 10px;
		font: inherit;
		font-size: var(--text-base);
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}
	input[type='text']:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 10px 0 0;
		padding: 0;
		list-style: none;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 6px 3px 8px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.chip .dot {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
	}
	.chip a {
		color: var(--accent);
		text-decoration: none;
	}
	.chip a:hover {
		text-decoration: underline;
	}
	.chip .role {
		color: var(--fg-muted);
		font-size: var(--text-2xs);
	}
	.chip button {
		font: inherit;
		padding: 0 2px;
		margin: 0;
		background: transparent;
		border: none;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.chip button:hover {
		color: var(--error);
	}
	.options {
		margin: 10px 0 0;
		padding: 4px;
		max-height: 220px;
		overflow-y: auto;
		list-style: none;
		border: 1px solid var(--border);
		background: var(--bg-secondary);
	}
	.options li {
		display: block;
	}
	.options label {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 4px 6px;
		cursor: pointer;
		font-size: var(--text-sm);
	}
	.options label:hover {
		background: var(--surface);
	}
	.options label.disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.options input {
		accent-color: var(--accent);
		flex-shrink: 0;
	}
	.options .name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.options .meta {
		color: var(--fg-muted);
		font-size: var(--text-2xs);
		white-space: nowrap;
	}
	.options .empty {
		padding: 4px 6px;
		color: var(--fg-muted);
		font-size: var(--text-sm);
	}
	.note {
		margin: 6px 0 0;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.empty-chart {
		color: var(--fg-secondary);
		font-size: var(--text-sm);
	}
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
	.line {
		fill: none;
		stroke-width: 2.5;
	}
	.end {
		stroke: var(--bg);
		stroke-width: 1.5;
	}
	.dot.active {
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
