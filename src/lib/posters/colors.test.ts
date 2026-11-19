import { describe, expect, it } from 'vitest';
import { compareSpectrum, swatchFromPixels, type Swatch } from './colors';

type Rgb = [number, number, number];

/** RGBA pixels with `accentShare` of them in the accent colour and the rest in the background. */
function poster(background: Rgb, accent: Rgb = background, accentShare = 0): Uint8ClampedArray {
	const count = 384;
	const pixels = new Uint8ClampedArray(count * 4);
	for (let i = 0; i < count; i++) {
		pixels.set([...(i < count * accentShare ? accent : background), 255], i * 4);
	}
	return pixels;
}

function swatch(background: number, hue: number | null, light = 0.5): Swatch {
	return { background, hue, light };
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const RED: Rgb = [220, 20, 30];

describe('swatchFromPixels', () => {
	it('reads the same accent hue off white and black backgrounds, but not the same tone', () => {
		const onWhite = swatchFromPixels(poster(WHITE, RED, 0.15));
		const onBlack = swatchFromPixels(poster(BLACK, RED, 0.15));
		expect(onWhite.background).toBeGreaterThan(0.9);
		expect(onBlack.background).toBeLessThan(0.1);
		expect(onWhite.hue).toBeCloseTo(onBlack.hue!, 3);
		expect(onWhite.hue).toBeGreaterThan(15);
		expect(onWhite.hue).toBeLessThan(45);
	});

	it('lets a small saturated accent beat a large muted background', () => {
		const { hue, background } = swatchFromPixels(poster([60, 50, 40], [30, 80, 230], 0.05));
		expect(background).toBeLessThan(0.45);
		expect(hue).toBeGreaterThan(240);
		expect(hue).toBeLessThan(290);
	});

	it('has no hue on a greyscale poster', () => {
		expect(swatchFromPixels(poster([120, 120, 120])).hue).toBeNull();
		expect(swatchFromPixels(poster(WHITE, BLACK, 0.3)).hue).toBeNull();
	});

	it('ignores an accent of only a stray pixel', () => {
		expect(swatchFromPixels(poster(WHITE, RED, 1 / 384)).hue).toBeNull();
	});
});

describe('compareSpectrum', () => {
	function sorted(items: Record<string, Swatch | undefined>): string[] {
		return Object.keys(items).sort((a, b) => compareSpectrum(items[a], items[b]));
	}

	it('groups by hue before background tone', () => {
		const order = sorted({
			'red-light': swatch(0.95, 30),
			'blue-dark': swatch(0.1, 260),
			'red-dark': swatch(0.1, 30)
		});
		expect(order.at(-1)).toBe('blue-dark');
	});

	/** Hues every 15 degrees round the whole wheel. */
	const WHEEL = Array.from({ length: 24 }, (_, i) => i * 15);

	it('orders one accent by background tone, one way or the other', () => {
		for (const hue of WHEEL) {
			const order = sorted({
				light: swatch(0.95, hue),
				mid: swatch(0.6, hue),
				dark: swatch(0.1, hue)
			});
			expect(
				[
					['dark', 'mid', 'light'],
					['light', 'mid', 'dark']
				],
				`hue ${hue}`
			).toContainEqual(order);
		}
	});

	it('orders one accent on one tone by its lightness, running the same way as the tone', () => {
		for (const hue of WHEEL) {
			const order = sorted({
				'dark-dim': swatch(0.1, hue, 0.2),
				'light-dim': swatch(0.95, hue, 0.2),
				'dark-bright': swatch(0.1, hue, 0.8),
				'light-bright': swatch(0.95, hue, 0.8)
			});
			const darkFirst = ['dark-dim', 'dark-bright', 'light-dim', 'light-bright'];
			expect([darkFirst, [...darkFirst].reverse()], `hue ${hue}`).toContainEqual(order);
		}
	});

	it('moves on to the next hues without jumping between dark and light', () => {
		// Every hue on a dark and on a light background, listed round the wheel from the hue the
		// order opens on. Wherever the order steps forward round the wheel it must stay on the
		// same tone; tone may only change where it turns back to run hues again on the other one.
		const hues = Array.from({ length: 72 }, (_, i) => i * 5);
		const tones = (from: number) => {
			const posters: Record<string, Swatch> = {};
			for (const hue of hues.map((h) => (h + from) % 360)) {
				posters[`${hue}-dark`] = swatch(0.1, hue);
				posters[`${hue}-light`] = swatch(0.95, hue);
			}
			return posters;
		};
		const start = tones(0)[sorted(tones(0))[0]].hue!;
		const posters = tones(start);
		const order = sorted(posters).map((key) => posters[key]);
		const turn = (hue: number) => (hue - start + 360) % 360;
		for (let i = 1; i < order.length; i++) {
			if (turn(order[i].hue!) > turn(order[i - 1].hue!)) {
				expect(order[i].background, `${order[i - 1].hue} to ${order[i].hue}`).toBe(
					order[i - 1].background
				);
			}
		}
	});

	it('opens the wheel at red and closes it at pink', () => {
		const hueOf = (colour: Rgb) => swatchFromPixels(poster(BLACK, colour, 0.3)).hue;
		expect(
			sorted({
				pink: swatch(0.1, hueOf([230, 60, 150])),
				blue: swatch(0.1, hueOf([30, 80, 230])),
				red: swatch(0.1, hueOf(RED)),
				orange: swatch(0.1, hueOf([240, 140, 20]))
			})
		).toEqual(['red', 'orange', 'blue', 'pink']);
	});

	it('puts greys after every hue and unread posters last', () => {
		const order = sorted({
			unread: undefined,
			'light-grey': swatch(0.95, null, 0.95),
			'light-colour': swatch(0.95, 200),
			'dark-grey': swatch(0.1, null, 0.1),
			'dark-colour': swatch(0.1, 200)
		});
		expect(new Set(order.slice(0, 2))).toEqual(new Set(['dark-colour', 'light-colour']));
		expect(order.slice(2)).toEqual(['dark-grey', 'light-grey', 'unread']);
	});
});
