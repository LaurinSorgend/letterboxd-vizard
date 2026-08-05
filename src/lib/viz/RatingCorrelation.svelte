<script lang="ts">
	import { bestPredictor, ratingCorrelation } from './ratingCorrelation';
	import type { EnrichedFilm } from '$lib/types';

	let { films }: { films: EnrichedFilm[] } = $props();

	const matrix = $derived(ratingCorrelation(films));
	const predictor = $derived(bestPredictor(matrix));

	/** -1..1 mapped onto the shared 10-bin Viridis ramp. */
	function bin(r: number): number {
		return Math.min(9, Math.max(0, Math.floor(((r + 1) / 2) * 10)));
	}

	function cellTitle(rowLabel: string, colLabel: string, r: number | null, n: number): string {
		if (r === null) return `${rowLabel} × ${colLabel}: not enough overlap (${n} films)`;
		return `${rowLabel} × ${colLabel}: r = ${r.toFixed(2)} across ${n} films`;
	}
</script>

<div class="scroll">
	<div
		class="grid"
		style="grid-template-columns: auto repeat({matrix.axes
			.length}, 64px); grid-template-rows: auto repeat({matrix.axes.length}, 44px);"
	>
		<span class="corner"></span>
		{#each matrix.axes as axis, c (axis.key)}
			<span class="col-label" style="grid-row: 1; grid-column: {c + 2};">{axis.label}</span>
		{/each}
		{#each matrix.axes as rowAxis, r (rowAxis.key)}
			<span class="row-label" style="grid-row: {r + 2}; grid-column: 1;">{rowAxis.label}</span>
			{#each matrix.axes as colAxis, c (colAxis.key)}
				{@const cell = matrix.cells[r][c]}
				<span
					class="cell"
					class:dark={cell.r !== null && bin(cell.r) >= 6}
					style="grid-row: {r + 2}; grid-column: {c + 2}; background: {cell.r === null
						? 'var(--bg-secondary)'
						: `var(--map-bin-${bin(cell.r)})`};"
					title={cellTitle(rowAxis.label, colAxis.label, cell.r, cell.n)}
				>
					<span data-numeric>{cell.r === null ? '—' : cell.r.toFixed(2)}</span>
				</span>
			{/each}
		{/each}
	</div>
</div>

<div class="legend" aria-hidden="true">
	<span class="less">−1</span>
	<span class="scale">
		{#each Array(10) as _, i (i)}
			<i class="swatch" style="background: var(--map-bin-{i});"></i>
		{/each}
	</span>
	<span class="more">+1</span>
</div>

{#if predictor}
	<p class="note">
		<strong>{predictor.label}</strong> tracks your taste most closely (r = {predictor.r.toFixed(
			2
		)}).
	</p>
{:else}
	<p class="note">Not enough overlap with any source yet to say which predicts your taste best.</p>
{/if}

<style>
	.scroll {
		overflow-x: auto;
		padding-bottom: 4px;
	}
	.grid {
		display: grid;
		gap: 2px;
		width: max-content;
		align-items: stretch;
	}
	.corner {
		grid-row: 1;
		grid-column: 1;
	}
	.col-label,
	.row-label {
		display: flex;
		align-items: center;
		font-size: var(--text-2xs);
		color: var(--fg-secondary);
	}
	.col-label {
		justify-content: center;
		text-align: center;
		align-items: end;
		padding-bottom: 4px;
	}
	.row-label {
		justify-content: flex-end;
		padding-right: 8px;
		text-align: right;
	}
	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-sm);
		/* Literal, not theme-mapped: the Viridis bins are fixed in every theme, so their
		   contrasting text must be too. */
		color: #fff;
	}
	.cell.dark {
		color: #11111b;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.scale {
		display: inline-flex;
		gap: 2px;
	}
	.swatch {
		width: 13px;
		height: 13px;
		display: inline-block;
	}
	.note {
		margin: 8px 0 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
</style>
