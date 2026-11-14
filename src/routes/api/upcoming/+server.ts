import { json, error } from '@sveltejs/kit';
import { FetchBudget, FETCHES_PER_REQUEST } from '$lib/server/budget';
import { getUpcomingCachedMany, putUpcomingCachedMany } from '$lib/server/cache';
import { getDb } from '$lib/server/db';
import { discoverUpcoming } from '$lib/server/discover';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import { RELEASE_KINDS, type ReleaseKind } from '$lib/releases/dates';
import type { UpcomingCandidate } from '$lib/types';
import type { D1Database } from '@cloudflare/workers-types';
import type { RequestHandler } from './$types';

const POPULAR_PAGES = 2;
const MAX_PEOPLE = 30;

interface UpcomingBody {
	region: string;
	kinds: ReleaseKind[];
	people: number[];
}

function parseBody(body: { region?: unknown; kinds?: unknown; people?: unknown } | null) {
	const region = body?.region;
	const kinds = body?.kinds;
	const people = body?.people ?? [];
	const valid =
		typeof region === 'string' &&
		/^[A-Z]{2}$/.test(region) &&
		Array.isArray(kinds) &&
		kinds.length > 0 &&
		kinds.every((k) => (RELEASE_KINDS as readonly unknown[]).includes(k)) &&
		Array.isArray(people) &&
		people.every((p) => Number.isInteger(p) && p > 0);
	if (!valid) {
		error(400, 'Expected body: { region: string, kinds: ReleaseKind[], people?: number[] }');
	}
	return {
		region,
		kinds: [...new Set(kinds as ReleaseKind[])],
		people: (people as number[]).slice(0, MAX_PEOPLE)
	} satisfies UpcomingBody;
}

async function fetchPage(
	budget: FetchBudget,
	region: string,
	kind: ReleaseKind,
	page: number,
	people?: number[]
): Promise<UpcomingCandidate[] | null> {
	try {
		return await discoverUpcoming(budget, region, kind, page, people);
	} catch (cause) {
		console.error(`tmdb discover failed: ${region}:${kind} page ${page}`, cause);
		return null;
	}
}

async function fetchPopular(
	budget: FetchBudget,
	region: string,
	kind: ReleaseKind
): Promise<{ candidates: UpcomingCandidate[]; complete: boolean }> {
	const pages = await Promise.all(
		Array.from({ length: POPULAR_PAGES }, (_, i) => fetchPage(budget, region, kind, i + 1))
	);
	return {
		candidates: pages.flatMap((p) => p ?? []),
		complete: pages.every((p) => p !== null)
	};
}

async function popularCandidates(
	db: D1Database,
	budget: FetchBudget,
	{ region, kinds }: UpcomingBody
): Promise<UpcomingCandidate[]> {
	const keyOf = (kind: ReleaseKind) => `${region}:${kind}`;
	const cached = await getUpcomingCachedMany(db, kinds.map(keyOf));
	const missing = kinds.filter((kind) => !cached.has(keyOf(kind)));
	const fetched = await Promise.all(missing.map((kind) => fetchPopular(budget, region, kind)));
	const toWrite: [string, UpcomingCandidate[]][] = [];
	missing.forEach((kind, i) => {
		if (fetched[i].complete) toWrite.push([keyOf(kind), fetched[i].candidates]);
	});
	if (toWrite.length > 0) await putUpcomingCachedMany(db, toWrite);
	const fresh = new Map(missing.map((kind, i) => [kind, fetched[i].candidates]));
	return kinds.flatMap((kind) => cached.get(keyOf(kind)) ?? fresh.get(kind) ?? []);
}

async function peopleCandidates(
	budget: FetchBudget,
	{ region, kinds, people }: UpcomingBody
): Promise<UpcomingCandidate[]> {
	if (people.length === 0) return [];
	const pages = await Promise.all(kinds.map((kind) => fetchPage(budget, region, kind, 1, people)));
	return pages.flatMap((p) => p ?? []);
}

/**
 * Body `{ region, kinds, people }`; answers films with an upcoming release of any of `kinds` in
 * `region`, the popular ones cached for a day plus uncached ones featuring any of `people`.
 */
export const POST: RequestHandler = async ({ request, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.RECOMMEND_LIMITER, getClientAddress());

	const body = parseBody(await request.json().catch(() => null));
	const db = await getDb(platform);
	const budget = new FetchBudget(FETCHES_PER_REQUEST);
	const [popular, personal] = await Promise.all([
		popularCandidates(db, budget, body),
		peopleCandidates(budget, body)
	]);
	const seen = new Set<number>();
	const candidates = [...popular, ...personal].filter(
		(c) => !seen.has(c.tmdbId) && Boolean(seen.add(c.tmdbId))
	);
	return json({ candidates });
};
