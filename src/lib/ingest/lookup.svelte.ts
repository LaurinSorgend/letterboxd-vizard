import { SvelteMap } from 'svelte/reactivity';

/** A batched server lookup: answers the items it could resolve, by key, and leaves the rest out. */
export type Fetcher<T, K, V> = (
	items: T[],
	onProgress: (done: number) => void,
	signal: AbortSignal
) => Promise<Map<K, V>>;

/**
 * Answers per key, kept for the page's lifetime so revisiting a view costs no requests. Keys the
 * last load could not resolve stay absent, and the next load asks for them again.
 */
export class CachedLookup<T, K, V> {
	readonly values = new SvelteMap<K, V>();
	progress = $state({ done: 0, total: 0 });
	#keyOf: (item: T) => K;
	#fetch: Fetcher<T, K, V>;

	constructor(keyOf: (item: T) => K, fetch: Fetcher<T, K, V>) {
		this.#keyOf = keyOf;
		this.#fetch = fetch;
	}

	get loading(): boolean {
		return this.progress.done < this.progress.total;
	}

	/** How many of `items` have no answer yet. */
	missing(items: T[]): number {
		return new Set(items.map(this.#keyOf).filter((key) => !this.values.has(key))).size;
	}

	/** Fetches the items without an answer; an aborted load keeps what it found. */
	async load(items: T[], signal: AbortSignal): Promise<void> {
		const wanted = [...new Map(items.map((item) => [this.#keyOf(item), item]))]
			.filter(([key]) => !this.values.has(key))
			.map(([, item]) => item);
		const total = wanted.length;
		this.progress = { done: 0, total };
		if (total === 0) return;
		const found = await this.#fetch(
			wanted,
			(done) => {
				if (!signal.aborted) this.progress = { done, total };
			},
			signal
		);
		for (const [key, value] of found) this.values.set(key, value);
		if (!signal.aborted) this.progress = { done: total, total };
	}
}
