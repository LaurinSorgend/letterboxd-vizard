/** Searchable multi-select state behind the people timeline and the rating radar pickers. */

interface PickerOption {
	key: string;
	name: string;
}

/** One colour per selectable slot, contrast-sorted so neighbours stay distinct in Latte and Mocha. */
const PALETTE = [
	'--ctp-mauve',
	'--ctp-teal',
	'--ctp-sapphire',
	'--ctp-maroon',
	'--ctp-peach',
	'--ctp-flamingo',
	'--ctp-sky',
	'--ctp-lavender'
];

/** As many picks as there are palette colours, so every selected item keeps its own. */
const MAX_SELECTED = PALETTE.length;
/** Options listed for a search; the rest are counted, not shown. */
const LIST_LIMIT = 40;

export type Picker<T extends PickerOption> = ReturnType<typeof createPicker<T>>;

/**
 * `options` is a getter so the picker follows a reactive source; `initial` picks the starting
 * selection from the options once, when the picker is created.
 */
export function createPicker<T extends PickerOption>(
	options: () => T[],
	initial: (options: T[]) => string[] = () => []
) {
	let search = $state('');
	let keys: string[] = $state(initial(options()).slice(0, MAX_SELECTED));

	const matches = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return q ? options().filter((o) => o.name.toLowerCase().includes(q)) : options();
	});
	const selected = $derived(
		keys.map((key) => options().find((o) => o.key === key)).filter((o): o is T => o !== undefined)
	);
	const atCap = $derived(keys.length >= MAX_SELECTED);

	return {
		get search() {
			return search;
		},
		set search(value: string) {
			search = value;
		},
		/** The options matching the search, up to the list limit. */
		get rows(): T[] {
			return matches.slice(0, LIST_LIMIT);
		},
		/** How many more options match than are listed. */
		get overflow(): number {
			return Math.max(0, matches.length - LIST_LIMIT);
		},
		/** The selected options, in the order they were picked. */
		get selected(): T[] {
			return selected;
		},
		get atCap(): boolean {
			return atCap;
		},
		isSelected: (key: string): boolean => keys.includes(key),
		/** Adds or removes an option; refuses new picks once the cap is reached. */
		toggle(key: string): void {
			if (keys.includes(key)) keys = keys.filter((k) => k !== key);
			else if (!atCap) keys = [...keys, key];
		},
		/** The colour of the option picked `index`-th. */
		color: (index: number): string => `var(${PALETTE[index % PALETTE.length]})`,
		/** The colour of an option, or null when it is not selected. */
		colorOf(key: string): string | null {
			const index = keys.indexOf(key);
			return index === -1 ? null : `var(${PALETTE[index % PALETTE.length]})`;
		}
	};
}
