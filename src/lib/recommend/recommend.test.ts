import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { film, tmdb } from '$lib/testing/fixtures';
import type { Recommendation } from '$lib/types';

const fetchRecommendations = vi.fn();
vi.mock('$lib/api/endpoints', () => ({
	fetchRecommendations: (...args: unknown[]) => fetchRecommendations(...args)
}));

const { excludedIds, fetchRecommendationsSettled } = await import('./recommend');

const rec = (tmdbId: number, pending = false): Recommendation => ({
	tmdbId,
	title: `Film ${tmdbId}`,
	year: 2020,
	posterPath: null,
	countries: pending ? [] : ['FR'],
	pending
});

describe('excludedIds', () => {
	const library = {
		films: [film({ tmdb: tmdb({ tmdbId: 1 }) }), film({ tmdb: tmdb({ tmdbId: -5 }) })],
		watchlist: [{ tmdb: tmdb({ tmdbId: 2 }) }, { tmdb: null }]
	};

	it('leaves out everything watched and the watchlist', () => {
		expect(excludedIds(library, false)).toEqual([1, 2]);
	});

	it('lets the watchlist through when asked', () => {
		expect(excludedIds(library, true)).toEqual([1]);
	});
});

describe('fetchRecommendationsSettled', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		fetchRecommendations.mockReset();
	});
	afterEach(() => vi.useRealTimers());

	it('fills pending films in by id on a retry', async () => {
		fetchRecommendations
			.mockResolvedValueOnce([rec(1), rec(2, true)])
			.mockResolvedValueOnce([rec(2)]);
		const updates: Recommendation[][][] = [];
		const run = fetchRecommendationsSettled(
			[[]],
			[],
			(sets) => updates.push(sets),
			() => true
		);
		await vi.runAllTimersAsync();
		await run;
		expect(updates).toHaveLength(2);
		expect(updates[1][0]).toEqual([rec(1), rec(2)]);
	});

	it('settles films still pending once the retries run out', async () => {
		fetchRecommendations.mockResolvedValue([rec(3, true)]);
		const updates: Recommendation[][][] = [];
		const run = fetchRecommendationsSettled(
			[[]],
			[],
			(sets) => updates.push(sets),
			() => true
		);
		await vi.runAllTimersAsync();
		await run;
		expect(updates.at(-1)![0][0].pending).toBe(false);
	});

	it('treats a failed request as no recommendations', async () => {
		fetchRecommendations.mockRejectedValue(new Error('down'));
		const updates: Recommendation[][][] = [];
		await fetchRecommendationsSettled(
			[[], []],
			[],
			(sets) => updates.push(sets),
			() => true
		);
		expect(updates).toEqual([[[], []]]);
	});

	it('reports failed only when every first request rejects', async () => {
		const flags: boolean[] = [];
		fetchRecommendations.mockRejectedValue(new Error('down'));
		await fetchRecommendationsSettled(
			[[], []],
			[],
			(_, failed) => flags.push(failed),
			() => true
		);
		fetchRecommendations.mockResolvedValue([rec(5)]);
		await fetchRecommendationsSettled(
			[[], []],
			[],
			(_, failed) => flags.push(failed),
			() => true
		);
		expect(flags).toEqual([true, false]);
	});

	it('stops delivering once a newer run has started', async () => {
		fetchRecommendations.mockResolvedValue([rec(4)]);
		const update = vi.fn();
		await fetchRecommendationsSettled([[]], [], update, () => false);
		expect(update).not.toHaveBeenCalled();
	});
});
