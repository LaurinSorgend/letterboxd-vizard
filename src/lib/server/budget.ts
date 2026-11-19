import { env } from '$env/dynamic/private';
import { DEFAULT_FETCH_BUDGET } from '$lib/types';

/** A lookup that could not finish now but may succeed if the client asks again. */
export class RetryLater extends Error {}

/** Signals that the per-invocation subrequest budget ran out before a lookup could finish. */
export class BudgetExhausted extends RetryLater {
	constructor() {
		super('fetch budget exhausted');
	}
}

/**
 * Caps upstream fetches per invocation. Workers' free plan allows 50 subrequests per request, so
 * every fetch is taken from here and lookups past the cap are deferred instead of dying mid-flight
 * when Workers cuts them off. Cache queries are not taken from it; see `fetchesPerRequest`.
 *
 * An optional reserve walls off part of the budget: `take` refuses to spend past it until
 * `releaseReserve` opens it, so an early phase can't starve a later one (e.g. seed lookups leaving
 * nothing for the record fetches that follow).
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

	/** @throws BudgetExhausted when none is left to spend */
	take(): void {
		if (this.exhausted) throw new BudgetExhausted();
		this.#remaining -= 1;
	}

	releaseReserve(): void {
		this.#reserve = 0;
	}
}

/**
 * Per-invocation cap on upstream fetches. The default (DEFAULT_FETCH_BUDGET, 40) leaves headroom
 * under the Workers free-plan limit of 50 subrequests for the request's D1 queries, a handful per
 * batch since each cache reads and writes a chunk of keys per query. Self-hosters (no such limit)
 * can raise it with FETCH_BUDGET. Only a positive integer overrides the default, so 0, negatives
 * and junk fall back to it rather than disabling or instantly exhausting the budget.
 */
export function fetchesPerRequest(): number {
	const override = Number(env.FETCH_BUDGET);
	return Number.isInteger(override) && override > 0 ? override : DEFAULT_FETCH_BUDGET;
}
