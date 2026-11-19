import pLimit from 'p-limit';

/** A poster reduced to its background tone and accent colour, in OKLab terms. */
export interface Swatch {
	/** Lightness of the largest colour cluster, 0–1. */
	background: number;
	/** Accent hue in degrees, or null when the poster is effectively greyscale. */
	hue: number | null;
	/** Lightness of the accent, or of the background on a greyscale poster. */
	light: number;
}

interface Lab {
	l: number;
	a: number;
	b: number;
}

interface Cluster extends Lab {
	/** Share of the poster's pixels, 0–1. */
	weight: number;
}

/** 2:3 like the posters themselves, and fine enough that a title or small accent survives. */
const SAMPLE_WIDTH = 16;
const SAMPLE_HEIGHT = 24;
const CONCURRENCY = 8;
const CLUSTERS = 5;
const ITERATIONS = 8;
const HUE_BUCKETS = 12;
/** Starts the first bucket at OKLab red, so the wheel opens there and red stays in one bucket. */
const HUE_START = 15;
/** Upper lightness limits of the dark and mid background tiers. */
const TIER_LIMITS = [0.45, 0.75];
/** Under this much chroma a cluster reads as grey and its hue would be noise. */
const CHROMA_FLOOR = 0.04;
/** Below this share of the poster a cluster is a stray pixel or two, not an accent. */
const ACCENT_MIN_WEIGHT = 0.02;

/** Thrown when the browser refuses to hand back pixels, i.e. the image arrived without CORS. */
class TaintedCanvasError extends Error {}

/**
 * Accent hue bucket, then background tier, then accent lightness. Tier and lightness run in
 * reverse on every other bucket so that neighbouring buckets meet at a similar tone. Greyscale
 * posters follow the last bucket and unread posters close the whole order.
 */
function spectrumKey(swatch: Swatch | undefined): [number, number, number] {
	if (!swatch) return [HUE_BUCKETS + 1, 0, 0];
	const tier = TIER_LIMITS.filter((limit) => swatch.background > limit).length;
	if (swatch.hue === null) return [HUE_BUCKETS, tier, swatch.light];
	const bucket = Math.floor((((swatch.hue - HUE_START + 360) % 360) / 360) * HUE_BUCKETS);
	const direction = bucket % 2 === 0 ? 1 : -1;
	return [bucket, direction * tier, direction * swatch.light];
}

/** Orders swatches in steps around the colour wheel, and within each step by tone. */
export function compareSpectrum(a: Swatch | undefined, b: Swatch | undefined): number {
	const [bucketA, tierA, lightA] = spectrumKey(a);
	const [bucketB, tierB, lightB] = spectrumKey(b);
	return bucketA - bucketB || tierA - tierB || lightA - lightB;
}

const swatches = new Map<string, Swatch | null>();

let scratch: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D {
	if (scratch) return scratch;
	const canvas = document.createElement('canvas');
	canvas.width = SAMPLE_WIDTH;
	canvas.height = SAMPLE_HEIGHT;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new TaintedCanvasError('no 2d context');
	scratch = ctx;
	return ctx;
}

function toLinear(channel: number): number {
	const value = channel / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function toOklab(red: number, green: number, blue: number): Lab {
	const r = toLinear(red);
	const g = toLinear(green);
	const b = toLinear(blue);
	const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const medium = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const short = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return {
		l: 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
		a: 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
		b: 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short
	};
}

function distance(p: Lab, q: Lab): number {
	return (p.l - q.l) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;
}

function mean(points: Lab[]): Lab {
	const sum = { l: 0, a: 0, b: 0 };
	for (const point of points) {
		sum.l += point.l;
		sum.a += point.a;
		sum.b += point.b;
	}
	return { l: sum.l / points.length, a: sum.a / points.length, b: sum.b / points.length };
}

function nearest(point: Lab, centroids: Lab[]): number {
	let best = 0;
	for (let i = 1; i < centroids.length; i++) {
		if (distance(point, centroids[i]) < distance(point, centroids[best])) best = i;
	}
	return best;
}

/**
 * Seeds from the mean and then always the pixel farthest from every seed so far. That keeps the
 * sort stable between runs, and gives a small accent its own cluster where random seeds may not.
 */
function seedCentroids(points: Lab[]): Lab[] {
	const centroids = [mean(points)];
	while (centroids.length < CLUSTERS) {
		let farthest = points[0];
		let reach = 0;
		for (const point of points) {
			const gap = distance(point, centroids[nearest(point, centroids)]);
			if (gap > reach) {
				farthest = point;
				reach = gap;
			}
		}
		if (reach === 0) break;
		centroids.push(farthest);
	}
	return centroids;
}

function kMeans(points: Lab[]): Cluster[] {
	let centroids = seedCentroids(points);
	let members: Lab[][] = [];
	for (let round = 0; round < ITERATIONS; round++) {
		members = centroids.map(() => []);
		for (const point of points) members[nearest(point, centroids)].push(point);
		centroids = members.map((group, i) => (group.length > 0 ? mean(group) : centroids[i]));
	}
	return centroids
		.map((centroid, i) => ({ ...centroid, weight: members[i].length / points.length }))
		.filter((cluster) => cluster.weight > 0);
}

function chroma(colour: Lab): number {
	return Math.hypot(colour.a, colour.b);
}

/** Summarises RGBA pixels as a swatch: the largest cluster's tone and the strongest accent. */
export function swatchFromPixels(pixels: Uint8ClampedArray): Swatch {
	const points: Lab[] = [];
	for (let i = 0; i < pixels.length; i += 4) {
		points.push(toOklab(pixels[i], pixels[i + 1], pixels[i + 2]));
	}
	const clusters = kMeans(points);
	const largest = clusters.reduce((a, b) => (b.weight > a.weight ? b : a));
	const accents = clusters.filter(
		(cluster) => chroma(cluster) >= CHROMA_FLOOR && cluster.weight >= ACCENT_MIN_WEIGHT
	);
	if (accents.length === 0) return { background: largest.l, hue: null, light: largest.l };
	const accent = accents.reduce((a, b) => (chroma(b) * b.weight > chroma(a) * a.weight ? b : a));
	const hue = (Math.atan2(accent.b, accent.a) * 180) / Math.PI;
	return { background: largest.l, hue: (hue + 360) % 360, light: accent.l };
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

/**
 * The CDN only sends CORS headers when asked, so a poster the wall already showed sits in the
 * HTTP cache without them and a CORS load of it fails. Refetching past the cache gets a copy
 * the canvas may read.
 */
async function refetchImage(url: string): Promise<ImageBitmap> {
	const response = await fetch(url, { mode: 'cors', cache: 'reload' });
	if (!response.ok) throw new Error(`could not load ${url}`);
	return createImageBitmap(await response.blob());
}

async function readSwatch(url: string): Promise<Swatch> {
	const image = await loadImage(url).catch(() => refetchImage(url));
	const ctx = context();
	ctx.clearRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
	ctx.drawImage(image, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
	try {
		return swatchFromPixels(ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data);
	} catch {
		throw new TaintedCanvasError(url);
	}
}

/**
 * Colour swatches for a batch of poster URLs, reporting progress as it goes. Returns null if
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
