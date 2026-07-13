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
