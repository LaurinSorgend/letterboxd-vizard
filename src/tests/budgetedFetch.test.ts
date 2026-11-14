import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetExhausted, FetchBudget, RetryLater } from '$lib/server/budget';
import { budgetedFetch } from '$lib/server/http';

const url = new URL('https://example.test/item');

function answers(...statuses: number[]) {
	const queue = [...statuses];
	const fetchMock = vi.fn(async () => new Response('body', { status: queue.shift() ?? 500 }));
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

async function settle<T>(promise: Promise<T>): Promise<T> {
	await vi.runAllTimersAsync();
	return promise;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('budgetedFetch', () => {
	it('returns the OK response after one retry of a transient failure', async () => {
		const fetchMock = answers(503, 200);
		const response = await settle(budgetedFetch(new FetchBudget(5), url, {}, 'test'));
		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('asks for a retry later when the upstream keeps failing or cannot be reached', async () => {
		answers(503, 429);
		const failing = budgetedFetch(new FetchBudget(5), url, {}, 'test');
		const rejected = expect(failing).rejects.toBeInstanceOf(RetryLater);
		await vi.runAllTimersAsync();
		await rejected;

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
		await expect(budgetedFetch(new FetchBudget(5), url, {}, 'test')).rejects.toBeInstanceOf(
			RetryLater
		);
	});

	it('fails for good on a permanent error, without retrying', async () => {
		const fetchMock = answers(404);
		const result = budgetedFetch(new FetchBudget(5), url, {}, 'test');
		await expect(result).rejects.not.toBeInstanceOf(RetryLater);
		await expect(result).rejects.toThrow('test failed: 404');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('defers instead of retrying when the budget cannot cover another attempt', async () => {
		answers(503);
		await expect(budgetedFetch(new FetchBudget(1), url, {}, 'test')).rejects.toBeInstanceOf(
			BudgetExhausted
		);
	});
});
