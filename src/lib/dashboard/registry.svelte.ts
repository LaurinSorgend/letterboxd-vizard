import { createContext, untrack } from 'svelte';

/** A dashboard section as the section nav lists it. */
export interface NavEntry {
	id: string;
	/** The nav label: the section title, or a shorter name so every entry fits on one line. */
	label: string;
	element: HTMLElement;
}

const inDocumentOrder = (a: NavEntry, b: NavEntry): number =>
	a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

/**
 * The sections on the page, in the order they render. Sections join on mount and leave on
 * destroy, so conditional ones (rewatches) and late ones (recommendations) come and go with
 * their markup.
 */
export class SectionRegistry {
	entries = $state.raw<NavEntry[]>([]);

	/**
	 * Lists a section; returns the function that unlists it. Untracked, so a section's effect
	 * that calls this depends only on its own props, not on every other section.
	 */
	add(entry: NavEntry): () => void {
		untrack(() => {
			this.entries = [...this.entries, entry].sort(inDocumentOrder);
		});
		return () =>
			untrack(() => {
				this.entries = this.entries.filter((e) => e !== entry);
			});
	}
}

export const [getSections, setSections] = createContext<SectionRegistry>();
