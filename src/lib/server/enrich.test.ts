import Database from 'better-sqlite3';
import pLimit from 'p-limit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestContext } from './batch';
import { FetchBudget } from './budget';
import { resolveEnrich } from './enrich';
import { d1Facade } from './local-db';

vi.mock('$env/dynamic/private', () => ({ env: { TMDB_API_KEY: 'test-key' } }));

beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** TMDB knowing one film, Arrival (2016), as movie 329865; every call is recorded. */
function tmdb() {
	const paths: string[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: URL) => {
			paths.push(url.pathname);
			if (url.pathname.startsWith('/3/search/movie')) {
				return Response.json({
					results: [{ id: 329865, title: 'Arrival', release_date: '2016-09-01' }]
				});
			}
			return Response.json({ id: 329865, title: 'Arrival', release_date: '2016-11-10' });
		})
	);
	return paths;
}

describe('resolveEnrich', () => {
	/** A fresh cache per test, so no test leans on what an earlier one stored. */
	function freshCache() {
		const sqlite = new Database(':memory:');
		const db = d1Facade(sqlite);
		const ctx = (): RequestContext => ({ db, budget: new FetchBudget(10), limit: pLimit(5) });
		const enrich = async () => resolveEnrich([{ name: 'Arrival', year: 2016 }], ctx());
		return { sqlite, enrich };
	}

	it('searches once, then answers the stored record without asking TMDB', async () => {
		const { enrich } = freshCache();
		const searched = tmdb();
		const first = await enrich();
		expect(first.results[0]).toMatchObject({ tmdbId: 329865, mediaType: 'movie', year: 2016 });
		expect(searched).toEqual(['/3/search/movie', '/3/movie/329865']);

		const again = tmdb();
		expect(await enrich()).toEqual(first);
		expect(again).toEqual([]);
	});

	it('fetches a matched film whose record is gone by id, without searching', async () => {
		const { sqlite, enrich } = freshCache();
		tmdb();
		await enrich();
		sqlite.exec('DELETE FROM tmdb_records');
		const fetched = tmdb();
		expect((await enrich()).results[0]).toMatchObject({ tmdbId: 329865 });
		expect(fetched).toEqual(['/3/movie/329865']);
	});
});
