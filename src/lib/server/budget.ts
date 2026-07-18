/** Signals that the per-invocation subrequest budget ran out before a lookup could finish. */
export class BudgetExhausted extends Error {
	constructor() {
		super('fetch budget exhausted');
	}
}

/**
 * Caps outbound subrequests per invocation. Workers' free plan allows 50 subrequests per request
 * and D1 queries count alongside HTTP fetches, so callers reserve every subrequest here and defer
 * the rest instead of dying mid-flight when Workers cuts them off at 50.
 *
 * An optional reserve walls off part of the budget: `take`/`tryTake` refuse to spend past it until
 * `releaseReserve` opens it, so an early phase can't starve a later one (e.g. seed lookups leaving
 * nothing for the poster fetches that follow).
 */
export class FetchBudget {
	#remaining: number;
	#reserve: number;

	constructor(subrequests: number, reserve = 0) {
		this.#remaining = subrequests;
		this.#reserve = Math.max(0, Math.min(reserve, subrequests));
	}

	get exhausted(): boolean {
		return this.#remaining <= this.#reserve;
	}

	/** Reserves one subrequest, or throws BudgetExhausted. */
	take(): void {
		if (this.exhausted) throw new BudgetExhausted();
		this.#remaining -= 1;
	}

	/** Reserves one subrequest, returning false instead of throwing once the budget is spent. */
	tryTake(): boolean {
		if (this.exhausted) return false;
		this.#remaining -= 1;
		return true;
	}

	/** Opens the reserved subrequests for use, e.g. once seed lookups hand off to poster fetches. */
	releaseReserve(): void {
		this.#reserve = 0;
	}
}

/**
 * Per-invocation subrequest cap (fetches and D1 queries alike). 40 leaves headroom under the
 * Workers free-plan 50-subrequest limit; self-hosters (no such limit) can raise it via the
 * FETCH_BUDGET env var. Only a positive integer overrides the default, so 0, negatives, and junk
 * fall back to 40 rather than silently disabling or instantly exhausting the budget.
 */
const budgetOverride = Number(process.env.FETCH_BUDGET);
export const FETCHES_PER_REQUEST =
	Number.isInteger(budgetOverride) && budgetOverride > 0 ? budgetOverride : 40;
