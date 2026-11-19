/**
 * Click-to-select state for a chart: one item at a time, clicking it again clears it. The
 * selection is held by key and looked up in `items()` on every read, so when the items are
 * rebuilt (a feed sync replaces the films) the open selection shows the new item, not a stale
 * copy, and clears itself if the key is gone.
 */
export function selectByKey<T, K>(items: () => Iterable<T>, keyOf: (item: T) => K) {
	let key: K | null = $state(null);
	return {
		get selected(): T | null {
			if (key === null) return null;
			for (const item of items()) if (keyOf(item) === key) return item;
			return null;
		},
		get key(): K | null {
			return key;
		},
		isSelected: (candidate: K) => key === candidate,
		toggle: (candidate: K) => {
			key = key === candidate ? null : candidate;
		},
		clear: () => {
			key = null;
		}
	};
}
