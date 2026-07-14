import type { D1Database } from '@cloudflare/workers-types';

/** Placeholder used in Cloudflare builds; the real DB comes from platform.env.DB. */
export function localDb(): D1Database {
	throw new Error('local-db is unavailable in the Cloudflare build; expected platform.env.DB');
}
