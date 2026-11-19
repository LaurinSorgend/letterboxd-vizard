import type { D1Database } from '@cloudflare/workers-types';

export async function getDb(platform: App.Platform | undefined): Promise<D1Database> {
	if (platform?.env?.DB) return platform.env.DB;
	return (await import('./local-db')).localDb();
}
