<script lang="ts" generics="T">
	import type { EnrichedFilm } from '$lib/types';
	import FilmLink from './FilmLink.svelte';

	type Cell = string | number | { film: EnrichedFilm };

	let {
		columns,
		rows,
		key,
		cells
	}: {
		/** Numeric columns align right and set in the numeral face. */
		columns: { label: string; numeric?: boolean }[];
		rows: T[];
		key: (row: T) => string | number;
		/** One cell per column; a `{ film }` cell links to the film. */
		cells: (row: T) => Cell[];
	} = $props();
</script>

<details>
	<summary>View as table</summary>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					{#each columns as column (column.label)}
						<th class:num={column.numeric}>{column.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (key(row))}
					<tr>
						{#each cells(row) as cell, i (i)}
							<td class:num={columns[i].numeric} data-numeric={columns[i].numeric || undefined}>
								{#if typeof cell === 'object'}
									<FilmLink film={cell.film} title={null} />
								{:else}
									{cell}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</details>

<style>
	details {
		margin-top: 12px;
	}
	summary {
		cursor: pointer;
		color: var(--fg-secondary);
		font-size: var(--text-sm);
	}
	.scroll {
		overflow-x: auto;
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
		white-space: nowrap;
	}
	thead tr {
		background: var(--bg-secondary);
	}
	.num {
		text-align: right;
	}
</style>
