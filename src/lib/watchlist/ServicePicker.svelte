<script lang="ts">
	import { imageUrl } from '$lib/viz/images';
	import type { ServiceCount } from './filter';

	let {
		counts,
		selected = $bindable()
	}: {
		counts: ServiceCount[];
		selected: number[];
	} = $props();

	/** The long tail of niche services hides behind a toggle so the common ones stay scannable. */
	const SHOWN = 12;
	let expanded = $state(false);

	const pickedFirst = $derived([
		...counts.filter((c) => selected.includes(c.provider.id)),
		...counts.filter((c) => !selected.includes(c.provider.id))
	]);
	const visible = $derived(expanded ? pickedFirst : pickedFirst.slice(0, SHOWN));

	function toggle(id: number, on: boolean) {
		selected = on ? [...selected, id] : selected.filter((s) => s !== id);
	}
</script>

<fieldset>
	<legend>
		My services
		{#if selected.length > 0}
			<button type="button" class="link" onclick={() => (selected = [])}>Clear</button>
		{/if}
	</legend>
	{#if counts.length === 0}
		<p class="note">None of your watchlist streams in this country right now.</p>
	{:else}
		<div class="services">
			{#each visible as { provider, films } (provider.id)}
				{@const logo = imageUrl(provider.logoPath, 'w45')}
				<label class:on={selected.includes(provider.id)}>
					<input
						type="checkbox"
						checked={selected.includes(provider.id)}
						onchange={(e) => toggle(provider.id, e.currentTarget.checked)}
					/>
					{#if logo}<img src={logo} alt="" width="20" height="20" />{/if}
					<span>{provider.name}</span>
					<span class="count">{films}</span>
				</label>
			{/each}
			{#if counts.length > SHOWN}
				<button type="button" class="link" onclick={() => (expanded = !expanded)}>
					{expanded ? 'Fewer' : `${counts.length - SHOWN} more`}
				</button>
			{/if}
		</div>
	{/if}
</fieldset>

<style>
	fieldset {
		border: none;
		margin: 0 0 16px;
		padding: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 8px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.services {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border: 1px solid var(--border);
		font-size: var(--text-sm);
		cursor: pointer;
	}
	label.on {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	label:has(input:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	input {
		accent-color: var(--accent);
		margin: 0;
	}
	img {
		display: block;
	}
	.count {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--fg-muted);
	}
	.link {
		font: inherit;
		font-size: var(--text-sm);
		margin-left: 8px;
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
	}
	.services .link {
		margin-left: 0;
		padding: 4px 8px;
	}
	.note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-muted);
	}
</style>
