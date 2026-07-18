/**
 * The URI when it is a plain web link (http/https), else null. Blocks `javascript:` and other
 * script-bearing schemes from a hand-edited export becoming a clickable link (self-XSS hardening).
 */
export function webHref(uri: string | null | undefined): string | null {
	if (!uri) return null;
	try {
		const { protocol } = new URL(uri);
		return protocol === 'http:' || protocol === 'https:' ? uri : null;
	} catch {
		return null;
	}
}
