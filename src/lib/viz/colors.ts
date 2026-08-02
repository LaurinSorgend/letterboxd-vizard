import pLimit from 'p-limit';

export interface Swatch {
	/** 0–360, and meaningless when `sat` is 0. */
	hue: number;
	sat: number;
	light: number;
}

/** Posters are read at 8×8: enough for a dominant colour, cheap enough to run over hundreds. */
const SAMPLE = 8;
const CONCURRENCY = 8;
const HUE_BINS = 12;
/** Under this much colour the poster is effectively greyscale and any hue would be noise. */
const SAT_FLOOR = 0.05;

/** Thrown when the browser refuses to hand back pixels, i.e. the image arrived without CORS. */
export class TaintedCanvasError extends Error {}

const swatches = new Map<string, Swatch | null>();

let scratch: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D {
	if (scratch) return scratch;
	const canvas = document.createElement('canvas');
	canvas.width = SAMPLE;
	canvas.height = SAMPLE;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new TaintedCanvasError('no 2d context');
	scratch = ctx;
	return ctx;
}

function toHsl(r: number, g: number, b: number): Swatch {
	const red = r / 255;
	const green = g / 255;
	const blue = b / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const light = (max + min) / 2;
	const span = max - min;
	if (span === 0) return { hue: 0, sat: 0, light };
	const sat = span / (1 - Math.abs(2 * light - 1));
	let hue: number;
	if (max === red) hue = ((green - blue) / span) % 6;
	else if (max === green) hue = (blue - red) / span + 2;
	else hue = (red - green) / span + 4;
	return { hue: (hue * 60 + 360) % 360, sat, light };
}

interface Bin {
	weight: number;
	hue: number;
	sat: number;
	light: number;
}

/**
 * The most present colour in a poster. Pixels are weighted by saturation and against the
 * extremes of lightness, so the black bars and white borders that edge so many posters
 * cannot win the vote on area alone.
 */
function dominant(pixels: Uint8ClampedArray): Swatch {
	const bins: Bin[] = Array.from({ length: HUE_BINS }, () => ({
		weight: 0,
		hue: 0,
		sat: 0,
		light: 0
	}));
	let total = 0;
	let meanLight = 0;
	for (let i = 0; i < pixels.length; i += 4) {
		const { hue, sat, light } = toHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
		meanLight += light / (pixels.length / 4);
		const weight = sat * Math.max(0, 1 - Math.abs(light - 0.5) * 1.2);
		if (weight <= 0) continue;
		const bin = bins[Math.min(HUE_BINS - 1, Math.floor((hue / 360) * HUE_BINS))];
		bin.weight += weight;
		bin.hue += hue * weight;
		bin.sat += sat * weight;
		bin.light += light * weight;
		total += weight;
	}
	if (total < SAMPLE * SAMPLE * SAT_FLOOR) return { hue: 0, sat: 0, light: meanLight };
	const best = bins.reduce((a, b) => (b.weight > a.weight ? b : a));
	return {
		hue: best.hue / best.weight,
		sat: best.sat / best.weight,
		light: best.light / best.weight
	};
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`could not load ${url}`));
		image.src = url;
	});
}

async function readSwatch(url: string): Promise<Swatch> {
	const image = await loadImage(url);
	const ctx = context();
	ctx.clearRect(0, 0, SAMPLE, SAMPLE);
	ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE);
	try {
		return dominant(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
	} catch {
		throw new TaintedCanvasError(url);
	}
}

/**
 * Dominant colours for a batch of poster URLs, reporting progress as it goes. Returns null if
 * the browser will not let the page read the pixels back, which is the whole reason this runs
 * on request rather than on load. Results are memoised, so re-sorting costs nothing.
 */
export async function extractPalette(
	urls: string[],
	onProgress: (done: number) => void
): Promise<Map<string, Swatch> | null> {
	const limit = pLimit(CONCURRENCY);
	const found = new Map<string, Swatch>();
	let done = 0;
	let tainted = false;

	await Promise.all(
		urls.map((url) =>
			limit(async () => {
				if (tainted) return;
				if (!swatches.has(url)) {
					try {
						swatches.set(url, await readSwatch(url));
					} catch (error) {
						if (error instanceof TaintedCanvasError) {
							// Not this poster's fault and not worth remembering: a retry would only
							// find an empty cache of failures and mistake it for a clean run.
							tainted = true;
							return;
						}
						// A single poster that will not load is another matter, and stays cached.
						swatches.set(url, null);
					}
				}
				const swatch = swatches.get(url);
				if (swatch) found.set(url, swatch);
				onProgress(++done);
			})
		)
	);

	return tainted ? null : found;
}
