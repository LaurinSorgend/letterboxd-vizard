import { json } from '@sveltejs/kit';
import { effectiveCountries } from '$lib/film/countries';
import { getOrCreate } from '$lib/maps';
import { readBatch, requestContext, resolveBatch } from '$lib/server/batch';
import { movieRecords } from '$lib/server/records';
import { related, type RelatedMovie } from '$lib/server/related';
import { MAX_SEEDS, type Recommendation, type Seed } from '$lib/types';
import type { RequestHandler } from './$types';

const MAX_RESULTS = 20;
/** Subrequests held back from the seed phase so a cold one cannot starve the records phase. */
const RECORDS_RESERVE = 15;

const isSeed = (item: unknown): item is Seed =>
	typeof (item as Seed | null)?.tmdbId === 'number' &&
	typeof (item as Seed | null)?.rating === 'number';

/**
 * Body `{ seeds, exclude }`; answers `{ results }`, the films most related to the seeds, weighted
 * by their ratings. Only the first MAX_SEEDS seeds count. A film whose record could not load yet
 * comes back `pending`, with the poster the recommendation itself carried. When no seed's list
 * could be read, nothing scores and the answer is empty.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const { items: seeds, body } = await readBatch(
		request,
		'seeds',
		isSeed,
		'{ seeds: { tmdbId: number, rating: number }[], exclude: number[] }'
	);
	const exclude = Array.isArray(body.exclude) ? (body.exclude as unknown[]) : [];
	const excluded = new Set(exclude.filter((id) => typeof id === 'number'));
	const ctx = await requestContext(platform, RECORDS_RESERVE);

	const chosen = seeds.slice(0, MAX_SEEDS);
	const seedIds = [...new Set(chosen.map((seed) => seed.tmdbId))];
	const lists = await resolveBatch(seedIds, related, ctx);
	const listOf = new Map(seedIds.map((id, i) => [id, lists.results[i] ?? []]));

	const scores = new Map<number, RelatedMovie & { score: number }>();
	for (const seed of chosen) {
		for (const movie of listOf.get(seed.tmdbId) ?? []) {
			if (excluded.has(movie.tmdbId)) continue;
			const entry = getOrCreate(scores, movie.tmdbId, () => ({ ...movie, score: 0 }));
			entry.score += Math.max(0.5, seed.rating - 2.5);
		}
	}
	const ranked = [...scores.values()]
		.sort((a, b) => b.score - a.score || (b.rating ?? 0) - (a.rating ?? 0))
		.slice(0, MAX_RESULTS);

	ctx.budget.releaseReserve();
	const records = await resolveBatch(
		ranked.map((film) => film.tmdbId),
		movieRecords,
		ctx
	);
	const pending = new Set(records.pending);
	const results = ranked.map((film, i): Recommendation => {
		const record = records.results[i];
		return {
			tmdbId: film.tmdbId,
			title: film.title,
			year: film.year,
			posterPath: record?.posterPath ?? film.posterPath,
			countries: record ? effectiveCountries(record) : [],
			pending: pending.has(i)
		};
	});
	return json({ results });
};
