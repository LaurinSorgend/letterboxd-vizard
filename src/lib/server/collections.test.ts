import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchBudget, RetryLater } from './budget';
import { fetchCollection } from './collections';

// SvelteKit bakes $env/dynamic/private from the environment at config time, so stubbing the
// process env in a test does not reach it.
vi.mock('$env/dynamic/private', () => ({ env: { TMDB_API_KEY: 'test-key' } }));

afterEach(() => {
	vi.unstubAllGlobals();
});

function stub(body: unknown, status = 200) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(body), { status }))
	);
}

describe('fetchCollection', () => {
	it("returns TMDB's name for the franchise and how many films it holds", async () => {
		stub({ id: 8091, name: 'Alien Collection', parts: [{}, {}, {}, {}, {}, {}] });
		await expect(fetchCollection(new FetchBudget(5), 8091)).resolves.toEqual({
			id: 8091,
			name: 'Alien Collection',
			total: 6
		});
	});

	it('fails for good, not for a retry, when TMDB has no such collection', async () => {
		stub({ status_code: 34 }, 404);
		const lookup = fetchCollection(new FetchBudget(5), 1);
		await expect(lookup).rejects.toThrow('404');
		await expect(lookup).rejects.not.toBeInstanceOf(RetryLater);
	});
});
