/** Deterministic 0–1 from an integer, so a layout always settles the same way. */
export function seeded(n: number): number {
	const x = Math.sin(n * 12.9898) * 43758.5453;
	return x - Math.floor(x);
}

/** Stable 32-bit integer from a string, e.g. a film URI, to feed `seeded` or a jitter. */
export function hashString(text: string): number {
	let hash = 0;
	for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
	return hash;
}

export function clamp(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}
