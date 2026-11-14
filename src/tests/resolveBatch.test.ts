import { describe, expect, it, vi } from 'vitest';
import { resolveBatch, type BatchLookup } from '$lib/server/batch';
import { BudgetExhausted } from '$lib/server/budget';

function lookup(over: Partial<BatchLookup<number, string>> = {}): BatchLookup<number, string> {
	return {
		getCached: async () => new Map([[1, 'cached']]),
		fetchOne: async (_budget, key) => `fetched ${key}`,
		putCached: async () => {},
		retryFailures: false,
		label: 'test',
		...over
	};
}

describe('resolveBatch', () => {
	it('answers cached and fetched keys in request order, null keys as null', async () => {
		const putCached = vi.fn(async () => {});
		const answer = await resolveBatch([2, null, 1, 2], lookup({ putCached }));
		expect(answer).toEqual({ results: ['fetched 2', null, 'cached', 'fetched 2'], pending: [] });
		expect(putCached).toHaveBeenCalledWith([[2, 'fetched 2']]);
	});

	it('sends a key the budget could not cover back as pending', async () => {
		const fetchOne = async () => {
			throw new BudgetExhausted();
		};
		const answer = await resolveBatch([2], lookup({ fetchOne }));
		expect(answer).toEqual({ results: [null], pending: [0] });
	});

	it('answers a failed lookup null, or pending when failures are retried', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetchOne = async (): Promise<string> => {
			throw new Error('tmdb 503');
		};
		expect((await resolveBatch([2], lookup({ fetchOne }))).pending).toEqual([]);
		expect((await resolveBatch([2], lookup({ fetchOne, retryFailures: true }))).pending).toEqual([
			0
		]);
	});
});
