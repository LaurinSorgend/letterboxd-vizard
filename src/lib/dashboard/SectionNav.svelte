<script lang="ts">
	import { getSections } from './registry.svelte';

	const registry = getSections();
	const sections = $derived(registry.entries);

	let currentId: string | null = $state(null);

	$effect(() => {
		const entries = sections;
		const visible = new Set<string>();
		// Band near the top of the viewport: whichever section crosses it is the one being read.
		const spy = new IntersectionObserver(
			(changes) => {
				for (const change of changes) {
					if (change.isIntersecting) visible.add(change.target.id);
					else visible.delete(change.target.id);
				}
				const topmost = entries.find((entry) => visible.has(entry.id));
				if (topmost) currentId = topmost.id;
			},
			{ rootMargin: '-8% 0px -80% 0px' }
		);
		for (const entry of entries) spy.observe(entry.element);
		return () => spy.disconnect();
	});

	// Above the first section, and whenever the current one goes away, mark the first.
	$effect(() => {
		if (!sections.some((entry) => entry.id === currentId)) currentId = sections[0]?.id ?? null;
	});

	function jump(id: string) {
		document.getElementById(id)?.scrollIntoView({ block: 'start' });
		currentId = id;
	}
</script>

{#if sections.length > 1}
	<nav aria-label="Visualisations">
		<ul>
			{#each sections as section (section.id)}
				<li>
					<a href="#{section.id}" aria-current={currentId === section.id ? 'location' : undefined}>
						{section.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
	<label class="jump">
		Jump to section
		<select value={currentId} onchange={(e) => jump(e.currentTarget.value)}>
			{#each sections as section (section.id)}
				<option value={section.id}>{section.label}</option>
			{/each}
		</select>
	</label>
{/if}

<style>
	/* Only wide viewports have gutter space beside the column; narrower ones get no nav. */
	nav {
		display: none;
	}
	/* A 1080px --column + 2 × (140px nav + 16px gap) = 1392px, leaving room for the focus ring at
	   1440. Media queries can't read the token, so this width follows it by hand. */
	@media (min-width: 1440px) {
		nav {
			display: block;
			position: fixed;
			top: 50%;
			transform: translateY(-50%);
			right: calc(50% + var(--column) / 2 + 16px);
			width: 140px;
			max-height: 80vh;
			overflow-y: auto;
		}
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	a {
		display: block;
		padding: 4px 10px;
		border-left: 2px solid var(--border);
		font-size: var(--text-xs);
		line-height: var(--leading-snug);
		color: var(--fg-secondary);
		text-decoration: none;
	}
	a:hover {
		color: var(--fg);
		background: var(--surface);
	}
	/*
	 * Stroked rather than `font-weight: 700`: a heavier face is wider, and a title that rewraps
	 * onto a second line changes the height of a nav that is centred on itself, so every other
	 * item jumps by half the difference as you scroll. Stroking leaves the metrics alone.
	 */
	a[aria-current] {
		border-left-color: var(--accent);
		color: var(--fg);
		-webkit-text-stroke: 0.35px currentColor;
	}
	.jump {
		display: none;
	}
	@media (max-width: 1439.98px) {
		.jump {
			position: sticky;
			top: 0;
			z-index: 2;
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 0;
			background: var(--bg);
			border-bottom: 1px solid var(--border);
			font-size: var(--text-sm);
			color: var(--fg-secondary);
		}
	}
	.jump select {
		flex: 1;
		min-width: 0;
		max-width: 20rem;
		background: var(--surface);
		color: var(--fg);
		border: 1px solid var(--border);
		padding: 4px 8px;
		font: inherit;
	}
	.jump select:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
