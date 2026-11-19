/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const target = process.env.DEPLOY_TARGET ?? 'cloudflare';

/**
 * In non-Node builds, swap the better-sqlite3 shim for a stub so the native addon never enters
 * the Cloudflare Worker bundle. Matched by resolved file, whatever the import calls it; tests run
 * in Node and keep the real one.
 */
function stubLocalDb(): Plugin {
	const real = fileURLToPath(new URL('./src/lib/server/local-db.ts', import.meta.url));
	const stub = fileURLToPath(new URL('./src/lib/server/local-db.stub.ts', import.meta.url));
	return {
		name: 'stub-local-db',
		enforce: 'pre',
		async resolveId(source, importer, options) {
			if (target === 'node' || process.env.VITEST || !source.includes('local-db')) return null;
			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
			return resolved?.id === real ? stub : null;
		}
	};
}

const ALPHA3_MODULE = 'virtual:alpha3-countries';

/**
 * `virtual:alpha3-countries`: ISO alpha-3 (lower case) to alpha-2 codes, for TheTVDB's countries.
 * Built from world-countries at build time, so the Worker bundle carries the pairs and not the
 * whole package.
 */
function alpha3Countries(): Plugin {
	const resolved = `\0${ALPHA3_MODULE}`;
	return {
		name: 'alpha3-countries',
		resolveId: (source) => (source === ALPHA3_MODULE ? resolved : null),
		load(id) {
			if (id !== resolved) return null;
			const countries = createRequire(import.meta.url)('world-countries') as {
				cca2: string;
				cca3: string;
			}[];
			const pairs = Object.fromEntries(countries.map((c) => [c.cca3.toLowerCase(), c.cca2]));
			return `export default ${JSON.stringify(pairs)};`;
		}
	};
}

export default defineConfig({
	plugins: [stubLocalDb(), alpha3Countries(), sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
