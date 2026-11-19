import { BudgetExhausted, RetryLater, type FetchBudget } from './budget';

const RETRY_WAIT_MS = 500;
const MAX_RETRY_WAIT_MS = 2000;

const isTransient = (status: number): boolean => status === 429 || status >= 500;

function retryWait(response: Response): Promise<void> {
	const after = Number(response.headers.get('Retry-After')) * 1000;
	const wait = after > 0 ? Math.min(after, MAX_RETRY_WAIT_MS) : RETRY_WAIT_MS;
	return new Promise((resolve) => setTimeout(resolve, wait));
}

/**
 * An upstream request that spends one subrequest per attempt and retries a 429/5xx once.
 * @returns the OK response
 * @throws RetryLater when the upstream is unreachable or still failing after the retry
 * @throws Error for any other non-OK answer, which asking again would not change
 */
export async function budgetedFetch(
	budget: FetchBudget,
	url: URL,
	init: RequestInit,
	label: string
): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		budget.take();
		const response = await fetch(url, init).catch((cause: unknown) => {
			throw new RetryLater(`${label} unreachable`, { cause });
		});
		if (response.ok) return response;
		const failure = `${label} failed: ${response.status} ${await response.text()}`;
		if (!isTransient(response.status)) throw new Error(failure);
		if (attempt > 0) throw new RetryLater(failure);
		if (budget.exhausted) throw new BudgetExhausted();
		await retryWait(response);
	}
}
