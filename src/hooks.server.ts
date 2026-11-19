import type { Handle } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/server/ratelimit';
import { issueSession, requireSession } from '$lib/server/session';

/**
 * Page loads get a session cookie; API calls must carry one and are rate-limited per client. An
 * unknown /api path has no route id and falls through to its 404 ungated.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const routeId = event.route.id;
	if (!event.url.pathname.startsWith('/api/')) {
		await issueSession(event.cookies);
	} else if (routeId) {
		await requireSession(event.cookies);
		await checkRateLimit(event, routeId);
	}
	return resolve(event);
};
