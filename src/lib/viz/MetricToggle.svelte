<script lang="ts" generics="T extends string">
	let {
		name,
		label,
		options,
		value = $bindable()
	}: {
		name: string;
		label: string;
		options: { value: T; label: string }[];
		value: T;
	} = $props();
</script>

<fieldset>
	<legend class="visually-hidden">{label}</legend>
	{#each options as option (option.value)}
		<label class:active={value === option.value}>
			<input type="radio" {name} value={option.value} bind:group={value} />
			{option.label}
		</label>
	{/each}
</fieldset>

<style>
	fieldset {
		border: none;
		margin: 0 0 8px;
		padding: 0;
		display: flex;
		gap: 8px;
	}
	label {
		padding: 4px 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}
	label.active {
		background: var(--accent);
		color: var(--on-accent);
		border-color: var(--accent);
	}
	input {
		position: absolute;
		opacity: 0;
	}
	label:has(input:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
