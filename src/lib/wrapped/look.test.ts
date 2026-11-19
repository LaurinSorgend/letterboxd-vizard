import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENTS } from './look';

describe('ACCENTS', () => {
	it('names exactly the hues wrapped.css defines', () => {
		const css = readFileSync(new URL('./wrapped.css', import.meta.url), 'utf8');
		const defined = [...css.matchAll(/\[data-hue='([a-z]+)'\]/g)].map((match) => match[1]);
		expect(new Set(defined)).toEqual(new Set(ACCENTS));
		expect(defined).toHaveLength(ACCENTS.length);
	});
});
