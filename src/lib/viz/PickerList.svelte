<script lang="ts" generics="T extends { key: string; name: string }">
	import type { Snippet } from 'svelte';
	import type { Picker } from './picker.svelte';

	let {
		picker,
		searchId,
		searchLabel,
		placeholder,
		optionsAriaLabel,
		chipContent,
		optionMeta
	}: {
		picker: Picker<T>;
		searchId: string;
		searchLabel: string;
		placeholder: string;
		optionsAriaLabel: string;
		chipContent?: Snippet<[T]>;
		optionMeta?: Snippet<[T]>;
	} = $props();
</script>

<div class="picker">
	<label class="search-label" for={searchId}>{searchLabel}</label>
	<input id={searchId} type="text" {placeholder} bind:value={picker.search} />

	{#if picker.selected.length > 0}
		<ul class="chips">
			{#each picker.selected as chip, i (chip.key)}
				<li class="chip">
					<span class="dot" style="background: {picker.color(i)}" aria-hidden="true"></span>
					{#if chipContent}
						{@render chipContent(chip)}
					{:else}
						<span>{chip.name}</span>
					{/if}
					<button
						type="button"
						aria-label="Remove {chip.name}"
						onclick={() => picker.toggle(chip.key)}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<ul class="options" role="group" aria-label={optionsAriaLabel}>
		{#each picker.rows as option (option.key)}
			{@const blocked = !picker.isSelected(option.key) && picker.atCap}
			<li>
				<label class:disabled={blocked}>
					<input
						type="checkbox"
						checked={picker.isSelected(option.key)}
						disabled={blocked}
						onchange={() => picker.toggle(option.key)}
					/>
					<span class="name">{option.name}</span>
					{#if optionMeta}{@render optionMeta(option)}{/if}
				</label>
			</li>
		{:else}
			<li class="empty">No match.</li>
		{/each}
	</ul>
	{#if picker.overflow > 0}
		<p class="note">+{picker.overflow} more</p>
	{/if}
</div>

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
</style>
