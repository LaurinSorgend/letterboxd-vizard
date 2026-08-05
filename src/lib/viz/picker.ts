/** Shared logic behind the searchable multi-select pickers (PeopleTimeline, RatingRadar). */

export interface PickerOption {
	key: string;
	name: string;
}

export interface FilteredOptions<T> {
	rows: T[];
	overflow: number;
}

/** Name-matches of `search` within `options`, capped to `limit` with the rest counted as overflow. */
export function filterOptions<T extends PickerOption>(
	options: T[],
	search: string,
	limit: number
): FilteredOptions<T> {
	const q = search.trim().toLowerCase();
	const matches = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
	return { rows: matches.slice(0, limit), overflow: Math.max(0, matches.length - limit) };
}

/** Adds or removes `key` from `keys`, refusing new additions once `atCap` is true. */
export function toggleSelection(keys: string[], key: string, atCap: boolean): string[] {
	if (keys.includes(key)) return keys.filter((k) => k !== key);
	return atCap ? keys : [...keys, key];
}

/** Stable colour for a selected item by its position in the palette, wrapping if oversubscribed. */
export function colorVar(palette: readonly string[], index: number): string {
	return `var(${palette[index % palette.length]})`;
}
