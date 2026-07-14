import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

const target = process.env.DEPLOY_TARGET ?? 'cloudflare';

/**
 * In non-Node builds, redirect the better-sqlite3 shim to a stub so the native
 * addon never enters the Cloudflare Worker bundle.
 */
function stubLocalDb(): Plugin {
	const stub = fileURLToPath(new URL('./src/lib/server/local-db.stub.ts', import.meta.url));
	return {
		name: 'stub-local-db',
		enforce: 'pre',
		resolveId(source, importer) {
			if (target === 'node') return null;
			const from = importer?.replace(/\\/g, '/');
			if (source === './local-db' && from?.endsWith('/src/lib/server/db.ts')) {
				return stub;
			}
			return null;
		}
	};
}

export default defineConfig({
	plugins: [stubLocalDb(), sveltekit()]
});
