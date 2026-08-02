/** Deterministic 0–1 from an integer, so a layout always settles the same way. */
export function seeded(n: number): number {
	const x = Math.sin(n * 12.9898) * 43758.5453;
	return x - Math.floor(x);
}

export function clamp(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}
