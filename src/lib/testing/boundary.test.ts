import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = /\.(ts|js|svelte)$/;
const TEST = /\.test\.ts$/;

/** Every source file under `dir`, test files and the testing helpers themselves left out. */
function nonTestModules(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory())
			return path === join('src', 'lib', 'testing') ? [] : nonTestModules(path);
		return SOURCE.test(entry.name) && !TEST.test(entry.name) ? [path] : [];
	});
}

/** Import specifiers that reach `src/lib/testing`, by alias or by relative path. */
const TESTING_IMPORT = /from\s+['"](\$lib\/testing|(\.\.?\/)+(lib\/)?testing)(\/[^'"]*)?['"]/;

describe('test fixtures', () => {
	it('are imported by no non-test module', () => {
		const modules = nonTestModules('src');
		expect(modules.length).toBeGreaterThan(50);
		const offenders = modules.filter((path) => TESTING_IMPORT.test(readFileSync(path, 'utf8')));
		expect(offenders).toEqual([]);
	});
});
