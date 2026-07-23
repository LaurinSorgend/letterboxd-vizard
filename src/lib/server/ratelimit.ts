import { error } from '@sveltejs/kit';
import type { RateLimit } from '@cloudflare/workers-types';

/** Throttles by client IP via a Cloudflare rate-limiting binding; a no-op where none is bound (self-host). */
export async function checkRateLimit(limiter: RateLimit | undefined, key: string): Promise<void> {
	if (!limiter) return;
	const { success } = await limiter.limit({ key });
	if (!success) error(429, 'Too many requests, slow down and try again shortly.');
}
