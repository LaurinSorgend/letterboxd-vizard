/** Signals that the per-invocation fetch budget ran out before a lookup could finish. */
export class BudgetExhausted extends Error {
	constructor() {
		super('fetch budget exhausted');
	}
}

/**
 * Caps outbound HTTP fetches per invocation. Workers' free plan allows 50
 * subrequests per request (D1 queries included), so lookups reserve fetches
 * here and defer the rest instead of dying mid-flight.
 */
export class FetchBudget {
	#remaining: number;

	constructor(fetches: number) {
		this.#remaining = fetches;
	}

	get exhausted(): boolean {
		return this.#remaining <= 0;
	}

	/** Reserves one fetch, or throws BudgetExhausted. */
	take(): void {
		if (this.#remaining <= 0) throw new BudgetExhausted();
		this.#remaining -= 1;
	}
}

/**
 * Per-invocation fetch cap. 40 fits the Workers free-plan 50-subrequest limit;
 * self-hosters (no such limit) can raise it via the FETCH_BUDGET env var. Only a
 * positive integer overrides the default, so 0, negatives, and junk fall back to
 * 40 rather than silently disabling or instantly exhausting the budget.
 */
const budgetOverride = Number(process.env.FETCH_BUDGET);
export const FETCHES_PER_REQUEST =
	Number.isInteger(budgetOverride) && budgetOverride > 0 ? budgetOverride : 40;
