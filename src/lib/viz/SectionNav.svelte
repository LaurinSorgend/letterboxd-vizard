<script lang="ts">
	import { untrack } from 'svelte';

	interface Section {
		id: string;
		title: string;
	}

	let { container = null }: { container?: HTMLElement | null } = $props();

	let sections: Section[] = $state([]);
	let currentId: string | null = $state(null);
	let spy: IntersectionObserver | null = null;
	const visible = new Set<string>();

	/** Re-reads the sections on the page and points the scroll-spy at them. */
	function sync(root: HTMLElement) {
		const found = [...root.querySelectorAll<HTMLElement>('section[id]')];
		sections = found.map((el) => ({
			id: el.id,
			title: el.querySelector('h2')?.textContent?.trim() ?? el.id
		}));
		visible.clear();
		spy?.disconnect();
		for (const el of found) spy?.observe(el);
		// Above the first section, and whenever the current one goes away, mark the first.
		if (!sections.some((section) => section.id === currentId)) {
			currentId = sections[0]?.id ?? null;
		}
	}

	function onIntersect(entries: IntersectionObserverEntry[]) {
		for (const entry of entries) {
			if (entry.isIntersecting) visible.add(entry.target.id);
			else visible.delete(entry.target.id);
		}
		const topmost = sections.find((section) => visible.has(section.id));
		if (topmost) currentId = topmost.id;
	}

	$effect(() => {
		const root = container;
		if (!root) return;
		// Band near the top of the viewport: whichever section crosses it is the one being read.
		spy = new IntersectionObserver(onIntersect, { rootMargin: '-8% 0px -80% 0px' });
		// Sections appear late — the rewatch chart is conditional and recommendations arrive async.
		const added = new MutationObserver(() => sync(root));
		added.observe(root, { childList: true });
		// Untracked: sync reads the state it writes, and re-running would tear the observers down.
		untrack(() => sync(root));
		return () => {
			spy?.disconnect();
			spy = null;
			added.disconnect();
		};
	});
</script>

{#if sections.length > 1}
	<nav aria-label="Visualisations">
		<ul>
			{#each sections as section (section.id)}
				<li>
					<a href="#{section.id}" aria-current={currentId === section.id ? 'location' : undefined}>
						{section.title}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<style>
	/* Only wide viewports have gutter space beside the 1080px column; narrower ones get no nav. */
	nav {
		display: none;
	}
	/* 1080px column + 2 × (140px nav + 16px gap) = 1392px, leaving room for the focus ring at 1440. */
	@media (min-width: 1440px) {
		nav {
			display: block;
			position: fixed;
			top: 50%;
			transform: translateY(-50%);
			right: calc(50% + 540px + 16px);
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
	a[aria-current] {
		border-left-color: var(--accent);
		color: var(--fg);
		font-weight: 700;
	}
</style>
