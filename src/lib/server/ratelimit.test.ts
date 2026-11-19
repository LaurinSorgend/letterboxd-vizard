import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIMITER_OF } from './ratelimit';

/** Route ids of every endpoint under src/routes/api, as SvelteKit names them. */
function apiRoutes(dir = 'src/routes/api', id = '/api'): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (entry.isDirectory()) return apiRoutes(`${dir}/${entry.name}`, `${id}/${entry.name}`);
		return entry.name === '+server.ts' ? [id] : [];
	});
}

describe('LIMITER_OF', () => {
	it('names a rate limiter for every API route, and only for those', () => {
		expect(Object.keys(LIMITER_OF).sort()).toEqual(apiRoutes().sort());
	});
});
