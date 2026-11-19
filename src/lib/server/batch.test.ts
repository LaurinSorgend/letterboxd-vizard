import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import pLimit from 'p-limit';
import { MAX_BATCH } from '$lib/types';
import { isInteger, readBatch, resolveBatch, type BatchLookup, type RequestContext } from './batch';
import { BudgetExhausted, FetchBudget, RetryLater } from './budget';

const ctx = (): RequestContext => ({
	db: {} as D1Database,
	budget: new FetchBudget(10),
	limit: pLimit(5)
});

type Lookup = BatchLookup<number, number, string>;

function lookup(over: Partial<Lookup> = {}): Lookup {
	return {
		keyOf: (id) => (id > 0 ? id : null),
		cache: { getMany: async () => new Map([[1, 'cached']]), putMany: async () => {} },
		fetchOne: async (_budget, id) => `fetched ${id}`,
		label: 'test',
		...over
	};
}

const failWith = (error: Error) => async (): Promise<string> => {
	throw error;
};

describe('resolveBatch', () => {
	it('answers cached and fetched items in request order, keyless items as null', async () => {
		const putMany = vi.fn(async () => {});
		const fetchOne = vi.fn(async (_budget: unknown, id: number) => `fetched ${id}`);
		const cache = { getMany: async () => new Map([[1, 'cached']]), putMany };
		const answer = await resolveBatch([2, -3, 1, 2], lookup({ cache, fetchOne }), ctx());
		expect(answer).toEqual({ results: ['fetched 2', null, 'cached', 'fetched 2'], pending: [] });
		expect(fetchOne).toHaveBeenCalledTimes(1);
		expect(putMany).toHaveBeenCalledWith({}, [[2, 'fetched 2']]);
	});

	it('sends a lookup that may succeed later back as pending', async () => {
		for (const error of [new BudgetExhausted(), new RetryLater('TMDB 503')]) {
			const answer = await resolveBatch([2], lookup({ fetchOne: failWith(error) }), ctx());
			expect(answer).toEqual({ results: [null], pending: [0] });
		}
	});

	it('answers a permanent failure null without asking for a retry or caching it', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const putMany = vi.fn(async () => {});
		const cache = { getMany: async () => new Map<number, string>(), putMany };
		const answer = await resolveBatch(
			[2],
			lookup({ fetchOne: failWith(new Error('TMDB 404')), cache }),
			ctx()
		);
		expect(answer).toEqual({ results: [null], pending: [] });
		expect(putMany).not.toHaveBeenCalled();
	});
});

describe('readBatch', () => {
	const post = (body: unknown) =>
		new Request('http://test/api', { method: 'POST', body: JSON.stringify(body) });

	it('answers the items and the rest of the body', async () => {
		const read = await readBatch(post({ ids: [1, 2], region: 'GB' }), 'ids', isInteger, 'ids');
		expect(read).toEqual({ items: [1, 2], body: { ids: [1, 2], region: 'GB' } });
	});

	it('answers 400 for a missing, malformed or oversized batch', async () => {
		for (const body of [
			null,
			{},
			{ ids: 'x' },
			{ ids: [1, 'x'] },
			{ ids: Array(MAX_BATCH + 1).fill(1) }
		]) {
			await expect(readBatch(post(body), 'ids', isInteger, 'ids')).rejects.toMatchObject({
				status: 400
			});
		}
	});
});
