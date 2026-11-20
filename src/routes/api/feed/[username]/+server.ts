import { json, error } from '@sveltejs/kit';
import { letterboxdFeedUrl } from '$lib/film/links';
import { parseFeed } from '$lib/ingest/rss';
import { USERNAME_PATTERN } from '$lib/types';
import type { RequestHandler } from './$types';

const USER_AGENT =
	'Mozilla/5.0 (compatible; vizard; +https://codeberg.org/LaurinS/letterboxd-vizard)';

/** Fetches a member's public Letterboxd RSS feed and returns its film entries as JSON. */
export const GET: RequestHandler = async ({ params }) => {
	const username = params.username;
	if (!USERNAME_PATTERN.test(username)) error(400, 'That is not a valid Letterboxd username.');

	const response = await fetch(letterboxdFeedUrl(username), {
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml' }
	}).catch(() => null);
	if (!response) error(502, 'Could not reach Letterboxd, try again shortly.');
	if (response.status === 404) error(404, `No Letterboxd member called "${username}".`);
	if (!response.ok) error(502, `Letterboxd refused the feed request (${response.status}).`);

	return json({ entries: parseFeed(await response.text()) });
};
