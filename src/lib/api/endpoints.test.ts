import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCollections, providersFetcher } from './endpoints';
import type { CollectionParts } from '$lib/types';

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), { status: 200 });
}

/** Runs the pauses between retry rounds, then answers what `promise` resolved to. */
async function settled<T>(promise: Promise<T>): Promise<T> {
	await vi.runAllTimersAsync();
	return promise;
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('fetchCollections', () => {
	it('dedupes ids, keeps only ids TMDB resolved to a collection, and names it for display', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			jsonResponse({
				results: [{ id: 1, name: 'Alien Collection', total: 6 }, null],
				pending: []
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		const found = await settled(fetchCollections([1, 1, 2]));

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body as string)).toEqual({ ids: [1, 2] });
		expect(found).toEqual<CollectionParts[]>([{ id: 1, name: 'Alien Collection', total: 6 }]);
	});

	it('retries a deferred id in a later round instead of treating it as missing', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					results: [{ id: 1, name: 'A', total: 2 }, null],
					pending: [1]
				})
			)
			.mockResolvedValueOnce(
				jsonResponse({
					results: [{ id: 2, name: 'B', total: 5 }],
					pending: []
				})
			);
		vi.stubGlobal('fetch', fetchMock);

		const found = await settled(fetchCollections([1, 2]));

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
		expect(secondCallBody).toEqual({ ids: [2] });
		expect(found).toEqual(
			expect.arrayContaining([
				{ id: 1, name: 'A', total: 2 },
				{ id: 2, name: 'B', total: 5 }
			])
		);
		expect(found).toHaveLength(2);
	});

	it('pauses before sending a retry round', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ results: [null], pending: [0] }))
			.mockResolvedValueOnce(
				jsonResponse({ results: [{ id: 1, name: 'A', total: 2 }], pending: [] })
			);
		vi.stubGlobal('fetch', fetchMock);

		const found = fetchCollections([1]);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(await settled(found)).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('sends a batch again after its request failed', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response('boom', { status: 500 }))
			.mockResolvedValueOnce(
				jsonResponse({ results: [{ id: 1, name: 'A', total: 2 }], pending: [] })
			);
		vi.stubGlobal('fetch', fetchMock);

		expect(await settled(fetchCollections([1]))).toEqual([{ id: 1, name: 'A', total: 2 }]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('drops an id whose batch keeps failing, without throwing', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

		const found = await settled(fetchCollections([1]));

		expect(found).toEqual([]);
	});
});

describe('providersFetcher', () => {
	const items = [
		{ tmdbId: 1, mediaType: 'movie' as const },
		{ tmdbId: 2, mediaType: 'tv' as const }
	];

	it('leaves out titles still missing after every round failed', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('slow down', { status: 429 })));

		const offers = await settled(providersFetcher('GB')(items));

		expect(offers.size).toBe(0);
	});

	it('sends nothing once aborted and answers no title', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const controller = new AbortController();
		controller.abort();

		const offers = await providersFetcher('GB')(items, undefined, controller.signal);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(offers.size).toBe(0);
	});

	it('keys offers by media type and id, with null for titles offered nowhere', async () => {
		const offer = { link: null, flatrate: [], free: [], ads: [], rent: [], buy: [] };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(jsonResponse({ results: [offer, null], pending: [] }))
		);

		const offers = await settled(providersFetcher('GB')(items));

		expect(offers.get('movie:1')).toEqual(offer);
		expect(offers.get('tv:2')).toBeNull();
	});
});
