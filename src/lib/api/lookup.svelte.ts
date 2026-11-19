import { SvelteMap } from 'svelte/reactivity';
import type { Fetcher } from './batch';

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

	/**
	 * How many of `items` the last load left without an answer; 0 while a load runs, since keys
	 * not fetched yet would otherwise read as failures.
	 */
	unresolved(items: T[]): number {
		if (this.loading) return 0;
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

/**
 * Keeps whichever lookup `lookup` returns loading `items`, aborting the previous load when either
 * changes. Call during component init.
 */
export function followLookup<T, K, V>(lookup: () => CachedLookup<T, K, V>, items: () => T[]): void {
	$effect(() => {
		const controller = new AbortController();
		void lookup().load(items(), controller.signal);
		return () => controller.abort();
	});
}
