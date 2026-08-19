import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchBudget } from './budget';
import { fetchCollection } from './tmdb';

afterEach(() => vi.unstubAllGlobals());

function stub(body: unknown, ok = true) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response)
	);
}

describe('fetchCollection', () => {
	it('returns the franchise name and how many films it holds', async () => {
		stub({ id: 8091, name: 'Alien Collection', parts: [{}, {}, {}, {}, {}, {}] });
		await expect(fetchCollection(new FetchBudget(5), 8091)).resolves.toEqual({
			id: 8091,
			name: 'Alien',
			total: 6
		});
	});

	it('returns null when TMDB has no such collection', async () => {
		stub({ status_code: 34 }, false);
		await expect(fetchCollection(new FetchBudget(5), 1)).resolves.toBeNull();
	});
});
