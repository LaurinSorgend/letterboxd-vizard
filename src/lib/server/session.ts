import { error, type Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const SESSION_COOKIE = 'lv_session';
export const SESSION_TTL_SECONDS = 6 * 60 * 60;

const ALGO = { name: 'HMAC', hash: 'SHA-256' };

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), ALGO, false, [
		'sign',
		'verify'
	]);
}

function toHex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
	for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	return bytes;
}

/** Mints a cookie value proving it was issued by this server, valid until SESSION_TTL_SECONDS from now. */
export async function mintSessionToken(secret: string): Promise<string> {
	const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
	const signature = await crypto.subtle.sign(
		ALGO,
		await hmacKey(secret),
		new TextEncoder().encode(String(expires))
	);
	return `${expires}.${toHex(signature)}`;
}

/** Verifies a session cookie value: correctly signed by this server and not yet expired. */
export async function verifySessionToken(
	secret: string,
	token: string | undefined
): Promise<boolean> {
	if (!token) return false;
	const [expiresRaw, signatureHex] = token.split('.');
	const expires = Number(expiresRaw);
	if (!Number.isFinite(expires) || expires < Date.now() || !signatureHex) return false;
	return crypto.subtle.verify(
		ALGO,
		await hmacKey(secret),
		fromHex(signatureHex),
		new TextEncoder().encode(expiresRaw)
	);
}

/**
 * Rejects requests without a valid session cookie, i.e. anything that didn't first load a page
 * from this app. Trivial for a scraper to defeat by loading the page first, but stops naive direct
 * calls to the API from scripts/bots that never touch the site.
 */
export async function requireSession(cookies: Cookies): Promise<void> {
	if (!env.SESSION_SECRET) error(500, 'SESSION_SECRET is not configured');
	const valid = await verifySessionToken(env.SESSION_SECRET, cookies.get(SESSION_COOKIE));
	if (!valid) error(403, 'Missing or expired session, reload the page and try again.');
}
