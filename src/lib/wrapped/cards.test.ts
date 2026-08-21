import { describe, expect, it } from 'vitest';
import { statBlock } from './cards';
import type { Palette } from './canvas';
import type { Scene } from './scenes';

const palette: Palette = {
	room: '#000',
	screen: '#fff',
	ink: '#111',
	muted: '#888',
	line: '#ccc',
	stamp: '#000',
	accent: '#f00',
	cast: 'rgba(0,0,0,0)'
};

const scene: Scene = {
	id: 'test',
	accent: 'gold',
	label: 'Five stars',
	value: '5',
	valueKind: 'number',
	note: 'note',
	stats: [
		{ label: 'Share', value: '10%' },
		{ label: 'Most-used rating', value: '★ 4.50' },
		{ label: 'In 2024', value: '21' }
	],
	body: { kind: 'none' }
};

/** A stand-in 2D context: `measureText` reports a monospace-style width per
 * character, wide enough that a long label outruns the 200px minimum column. */
function fakeContext() {
	const calls: { text: string; x: number; y: number }[] = [];
	const ctx = {
		fillStyle: '',
		font: '',
		fillRect: () => {},
		fillText: (text: string, x: number, y: number) => calls.push({ text, x, y }),
		measureText: (text: string) => ({ width: text.length * 16 })
	};
	return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('statBlock', () => {
	it('spaces stat columns wide enough that a long label never overlaps the next one', () => {
		const { ctx, calls } = fakeContext();
		statBlock(ctx, scene, palette).draw(0);

		// Each stat prints its label then its value, in order: label, value, label, value...
		const [share, , mostUsed, , inYear] = calls;
		expect(share.text).toBe('SHARE');
		expect(mostUsed.text).toBe('MOST-USED RATING');
		expect(inYear.text).toBe('IN 2024');

		// The third label must start no earlier than the second label's own width
		// allows, or "MOST-USED RATING" and "IN 2024" print on top of each other.
		const mostUsedWidth = mostUsed.text.length * 16;
		expect(inYear.x).toBeGreaterThanOrEqual(mostUsed.x + mostUsedWidth);
	});
});
