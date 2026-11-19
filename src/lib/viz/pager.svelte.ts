/** How many rows each "Show more" click adds. */
export const PAGE_STEP = 20;

/**
 * Show-more paging for a list: opens with `initial()` rows and grows by `PAGE_STEP` per click.
 * Once everything is shown, `reset` collapses back to the first `initial()`.
 */
export function pager(total: () => number, initial: () => number) {
	let pages = $state(0);
	const limit = () => initial() + pages * PAGE_STEP;
	return {
		get shown(): number {
			return Math.min(limit(), total());
		},
		get remaining(): number {
			return Math.max(0, total() - limit());
		},
		get pageable(): boolean {
			return total() > initial();
		},
		more: () => {
			pages += 1;
		},
		reset: () => {
			pages = 0;
		}
	};
}

export type Pager = ReturnType<typeof pager>;
