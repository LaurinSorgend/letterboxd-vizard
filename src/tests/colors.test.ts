import { describe, expect, it } from 'vitest';
import { compareSpectrum, swatchFromPixels, type Swatch } from '$lib/viz/colors';

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

	it('groups by hue bucket before background tier', () => {
		expect(
			sorted({
				'blue-dark': swatch(0.1, 260),
				'red-light': swatch(0.95, 30),
				'red-dark': swatch(0.1, 30)
			})
		).toEqual(['red-dark', 'red-light', 'blue-dark']);
	});

	it('separates the same accent by background tier, dark first on an even bucket', () => {
		expect(
			sorted({
				light: swatch(0.95, 30),
				mid: swatch(0.6, 30),
				dark: swatch(0.1, 30)
			})
		).toEqual(['dark', 'mid', 'light']);
	});

	it('reverses tier and lightness on an odd bucket', () => {
		expect(
			sorted({
				'dark-dim': swatch(0.1, 60, 0.2),
				'light-dim': swatch(0.95, 60, 0.2),
				'dark-bright': swatch(0.1, 60, 0.8),
				'light-bright': swatch(0.95, 60, 0.8)
			})
		).toEqual(['light-bright', 'light-dim', 'dark-bright', 'dark-dim']);
	});

	it('flips the lightness direction between neighbouring hue buckets', () => {
		expect(
			sorted({
				'odd-dark': swatch(0.1, 60, 0.2),
				'even-light': swatch(0.1, 20, 0.8),
				'odd-light': swatch(0.1, 60, 0.8),
				'even-dark': swatch(0.1, 20, 0.2)
			})
		).toEqual(['even-dark', 'even-light', 'odd-light', 'odd-dark']);
	});

	it('keeps red in the first bucket and wraps pink to the last', () => {
		expect(sorted({ pink: swatch(0.1, 5), red: swatch(0.1, 29) })).toEqual(['red', 'pink']);
	});

	it('puts greys after every hue and unread posters last', () => {
		expect(
			sorted({
				unread: undefined,
				'light-grey': swatch(0.95, null, 0.95),
				'light-colour': swatch(0.95, 200),
				'dark-grey': swatch(0.1, null, 0.1),
				'dark-colour': swatch(0.1, 200)
			})
		).toEqual(['dark-colour', 'light-colour', 'dark-grey', 'light-grey', 'unread']);
	});
});
