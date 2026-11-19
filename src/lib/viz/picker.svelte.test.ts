import { describe, expect, it } from 'vitest';
import { createPicker } from './picker.svelte';

const options = Array.from({ length: 50 }, (_, i) => ({ key: `k${i}`, name: `Name ${i}` }));

describe('createPicker', () => {
	it('lists search matches up to the limit and counts the rest', () => {
		const picker = createPicker(() => options);
		expect(picker.rows).toHaveLength(40);
		expect(picker.overflow).toBe(10);
		picker.search = 'name 1';
		expect(picker.rows.map((o) => o.key)).toEqual([
			'k1',
			...Array.from({ length: 10 }, (_, i) => `k${10 + i}`)
		]);
		expect(picker.overflow).toBe(0);
	});

	it('keeps picks in order with a colour each, and stops at the cap', () => {
		const picker = createPicker(() => options);
		for (const option of options.slice(0, 10)) picker.toggle(option.key);
		expect(picker.selected.map((o) => o.key)).toEqual(options.slice(0, 8).map((o) => o.key));
		expect(picker.atCap).toBe(true);
		expect(new Set(picker.selected.map((_, i) => picker.color(i))).size).toBe(8);
		picker.toggle('k0');
		expect(picker.isSelected('k0')).toBe(false);
		expect(picker.colorOf('k0')).toBeNull();
		expect(picker.colorOf('k1')).toBe(picker.color(0));
	});

	it('starts from the initial picks', () => {
		const picker = createPicker(
			() => options,
			(all) => all.slice(0, 2).map((o) => o.key)
		);
		expect(picker.selected.map((o) => o.name)).toEqual(['Name 0', 'Name 1']);
	});
});
