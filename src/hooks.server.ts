import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	SESSION_TTL_SECONDS,
	mintSessionToken,
	verifySessionToken
} from '$lib/server/session';

/** Mints a session cookie on real page loads so API routes can tell those apart from direct calls. */
export const handle: Handle = async ({ event, resolve }) => {
	if (!event.url.pathname.startsWith('/api/') && env.SESSION_SECRET) {
		const current = event.cookies.get(SESSION_COOKIE);
		if (!(await verifySessionToken(env.SESSION_SECRET, current))) {
			event.cookies.set(SESSION_COOKIE, await mintSessionToken(env.SESSION_SECRET), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				maxAge: SESSION_TTL_SECONDS
			});
		}
	}
	return resolve(event);
};
