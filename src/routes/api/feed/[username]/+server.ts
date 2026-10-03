import { json, error } from '@sveltejs/kit';
import { parseFeed } from '$lib/ingest/rss';
import { checkRateLimit } from '$lib/server/ratelimit';
import { requireSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

const USERNAME = /^[A-Za-z0-9_]{2,30}$/;
const USER_AGENT =
	'Mozilla/5.0 (compatible; letterboxd-vizard; +https://codeberg.org/LaurinS/letterboxd-vizard)';

/** Fetches a member's public Letterboxd RSS feed and returns its film entries as JSON. */
export const GET: RequestHandler = async ({ params, platform, cookies, getClientAddress }) => {
	await requireSession(cookies);
	await checkRateLimit(platform?.env?.ENRICH_LIMITER, getClientAddress());

	const username = params.username;
	if (!USERNAME.test(username)) error(400, 'That is not a valid Letterboxd username.');

	const response = await fetch(`https://letterboxd.com/${username.toLowerCase()}/rss/`, {
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml' }
	}).catch(() => null);
	if (!response) error(502, 'Could not reach Letterboxd, try again shortly.');
	if (response.status === 404) error(404, `No Letterboxd member called "${username}".`);
	if (!response.ok) error(502, `Letterboxd refused the feed request (${response.status}).`);

	return json({ entries: parseFeed(await response.text()) });
};
