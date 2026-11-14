import { describe, expect, it, vi } from 'vitest';
import { resolveBatch, type BatchLookup } from '$lib/server/batch';
import { BudgetExhausted, RetryLater } from '$lib/server/budget';

type Lookup = BatchLookup<number, number, string>;

function lookup(over: Partial<Lookup> = {}): Lookup {
	return {
		keyOf: (id) => (id > 0 ? id : null),
		getCached: async () => new Map([[1, 'cached']]),
		fetchOne: async (_budget, id) => `fetched ${id}`,
		putCached: async () => {},
		label: 'test',
		...over
	};
}

const failWith = (error: Error) => async (): Promise<string> => {
	throw error;
};

describe('resolveBatch', () => {
	it('answers cached and fetched items in request order, keyless items as null', async () => {
		const putCached = vi.fn(async () => {});
		const fetchOne = vi.fn(async (_budget: unknown, id: number) => `fetched ${id}`);
		const answer = await resolveBatch([2, -3, 1, 2], lookup({ putCached, fetchOne }));
		expect(answer).toEqual({ results: ['fetched 2', null, 'cached', 'fetched 2'], pending: [] });
		expect(fetchOne).toHaveBeenCalledTimes(1);
		expect(putCached).toHaveBeenCalledWith([[2, 'fetched 2']]);
	});

	it('sends a lookup that may succeed later back as pending', async () => {
		for (const error of [new BudgetExhausted(), new RetryLater('TMDB 503')]) {
			const answer = await resolveBatch([2], lookup({ fetchOne: failWith(error) }));
			expect(answer).toEqual({ results: [null], pending: [0] });
		}
	});

	it('answers a permanent failure null without asking for a retry or caching it', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const putCached = vi.fn(async () => {});
		const answer = await resolveBatch(
			[2],
			lookup({ fetchOne: failWith(new Error('TMDB 404')), putCached })
		);
		expect(answer).toEqual({ results: [null], pending: [] });
		expect(putCached).not.toHaveBeenCalled();
	});
});
