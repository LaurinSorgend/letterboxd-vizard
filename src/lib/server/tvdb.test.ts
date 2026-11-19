import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchBudget, RetryLater } from './budget';
import { lookupSeriesOnTvdb } from './tvdb';

vi.mock('$env/dynamic/private', () => ({ env: { TVDB_API_KEY: 'test-key' } }));

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

const search = { data: [{ tvdb_id: '81189', name: 'Breaking Bad', year: '2008', country: 'usa' }] };

/** Answers TheTVDB's login and search, and `details` for the extended record. */
function tvdb(details: Response) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: URL) => {
			if (url.pathname.endsWith('/login')) return Response.json({ data: { token: 't' } });
			if (url.pathname.endsWith('/search')) return Response.json(search);
			return details.clone();
		})
	);
}

describe('lookupSeriesOnTvdb', () => {
	it('keeps the search hit when TheTVDB has no extended record for it', async () => {
		tvdb(new Response('not found', { status: 404 }));
		const series = await lookupSeriesOnTvdb(new FetchBudget(10), 'Breaking Bad', 2008);
		expect(series).toMatchObject({ tmdbId: -81189, year: 2008, countries: ['US'], genres: [] });
	});

	it('asks again rather than answering a degraded record when TheTVDB is down', async () => {
		vi.useFakeTimers();
		tvdb(new Response('down', { status: 503 }));
		const lookup = expect(
			lookupSeriesOnTvdb(new FetchBudget(10), 'Breaking Bad', 2008)
		).rejects.toBeInstanceOf(RetryLater);
		await vi.runAllTimersAsync();
		await lookup;
	});
});
