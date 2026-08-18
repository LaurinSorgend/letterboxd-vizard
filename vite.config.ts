/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

const target = process.env.DEPLOY_TARGET ?? 'cloudflare';

/**
 * In non-Node builds, redirect the better-sqlite3 shim to a stub so the native
 * addon never enters the Cloudflare Worker bundle. Only db.ts imports
 * './local-db', so matching the specifier is enough.
 */
function stubLocalDb(): Plugin {
	const stub = fileURLToPath(new URL('./src/lib/server/local-db.stub.ts', import.meta.url));
	return {
		name: 'stub-local-db',
		enforce: 'pre',
		resolveId(source) {
			if (target === 'node') return null;
			return source === './local-db' ? stub : null;
		}
	};
}

export default defineConfig({
	plugins: [stubLocalDb(), sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
