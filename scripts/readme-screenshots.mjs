/**
 * Retakes the README screenshots in docs/assets from the dev server's `?demo` route, in the
 * Latte theme with the Peach accent. Needs `pnpm dev` running, `static/demo-export.zip`, and a
 * Chromium browser (Edge or Chrome; set BROWSER to its path if it is not found).
 *
 * Usage: pnpm screenshots   (BASE_URL defaults to http://localhost:5173)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const PORT = 9300 + Math.floor(Math.random() * 600);
const VIEWPORT = { width: 1600, height: 1000 };
const READY_TIMEOUT_MS = 10 * 60 * 1000;
const PAD = 16;
const OUT = join(import.meta.dirname, '..', 'docs', 'assets');

const BROWSERS = [
	'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
	'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium',
	'/usr/bin/chromium-browser',
	'/usr/bin/microsoft-edge'
];

/**
 * The page regions to capture, each an in-page expression returning document bounds, after an
 * optional in-page `prepare` step. `fullPage` shots render past the viewport; the first stays a
 * plain viewport so the fixed side nav shows.
 */
const SHOTS = [
	{ file: '1.jpg', bounds: `viewportBounds()`, fullPage: false },
	{
		file: '2.jpg',
		bounds: `unionBounds('#when h3', '#when section[aria-label]:nth-of-type(2)')`,
		fullPage: true
	},
	{ file: '3.jpg', bounds: `unionBounds('#people')`, fullPage: true },
	{
		file: '4.jpg',
		prepare: `showKeywordCloud()`,
		bounds: `unionBounds('#keywords')`,
		fullPage: true
	},
	{
		file: '5.jpg',
		prepare: `sortPostersByColour()`,
		bounds: `unionBounds('#mosaic')`,
		fullPage: true
	}
];

const PAGE_HELPERS = `
	window.viewportBounds = () => ({ x: 0, y: 0, width: innerWidth, height: innerHeight });
	window.unionBounds = (...selectors) => {
		const rects = selectors.map((s) => document.querySelector(s)?.getBoundingClientRect());
		if (rects.some((r) => !r)) return null;
		const top = Math.min(...rects.map((r) => r.top)) + scrollY;
		const bottom = Math.max(...rects.map((r) => r.bottom)) + scrollY;
		const left = Math.min(...rects.map((r) => r.left));
		const right = Math.max(...rects.map((r) => r.right));
		return { x: left - ${PAD}, y: top - ${PAD}, width: right - left + ${2 * PAD}, height: bottom - top + ${2 * PAD} };
	};
	window.waitFor = async (test, ms, what) => {
		const deadline = Date.now() + ms;
		while (!test()) {
			if (Date.now() > deadline) throw new Error('Timed out waiting for ' + what);
			await new Promise((r) => setTimeout(r, 250));
		}
	};
	window.showKeywordCloud = async () => {
		document.querySelector('#keywords')?.scrollIntoView();
		await waitFor(() => document.querySelector('#keywords canvas'), 10000, 'the keyword cloud');
		await new Promise((r) => setTimeout(r, 3000));
	};
	window.sortPostersByColour = async () => {
		const mosaic = document.querySelector('#mosaic');
		mosaic.scrollIntoView();
		const button = [...mosaic.querySelectorAll('button')].find((b) => b.textContent.includes('Sort by colour'));
		button?.click();
		await waitFor(() => mosaic.querySelector('select')?.value === 'colour', 120000, 'the colour sort');
	};
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser() {
	const path = process.env.BROWSER ?? BROWSERS.find((candidate) => existsSync(candidate));
	if (!path) throw new Error('No Chromium browser found; set BROWSER to its path.');
	return path;
}

/** Starts a headless browser and returns a CDP `send` bound to one fresh page. */
async function openPage(profile) {
	spawn(findBrowser(), [
		'--headless=new',
		'--hide-scrollbars',
		`--remote-debugging-port=${PORT}`,
		`--user-data-dir=${profile}`,
		'about:blank'
	]);
	const socket = new WebSocket(await debuggerUrl());
	await new Promise((resolve) => socket.addEventListener('open', resolve));
	const pending = new Map();
	let nextId = 0;
	socket.addEventListener('message', ({ data }) => {
		const message = JSON.parse(data);
		pending.get(message.id)?.(message);
		pending.delete(message.id);
	});
	const raw = (method, params = {}, sessionId) =>
		new Promise((resolve, reject) => {
			const id = ++nextId;
			pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
			socket.send(JSON.stringify({ id, method, params, sessionId }));
		});
	const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
	const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
	return {
		send: (method, params) => raw(method, params, sessionId),
		close: () => raw('Browser.close')
	};
}

async function debuggerUrl() {
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
			return (await response.json()).webSocketDebuggerUrl;
		} catch {
			await sleep(250);
		}
	}
	throw new Error('The browser did not open its debugging port.');
}

async function evaluate(send, expression) {
	const { result, exceptionDetails } = await send('Runtime.evaluate', {
		expression,
		awaitPromise: true,
		returnByValue: true
	});
	if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? expression);
	return result.value;
}

/** Waits until the demo library is analysed and the year-in-review dialog is closed. */
async function waitForDashboard(send) {
	const deadline = Date.now() + READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const state = await evaluate(
			send,
			`(() => {
				document.querySelector('dialog[open]')?.close();
				if (document.querySelector('.lookup-failed')) return 'failed';
				return !document.querySelector('.progress') && document.querySelector('#people') ? 'ready' : 'working';
			})()`
		);
		if (state === 'failed') throw new Error('Film lookups failed; is the TMDB cache reachable?');
		if (state === 'ready') return;
		await sleep(1000);
	}
	throw new Error('The demo did not finish loading in time.');
}

/** Scrolls through a region a screen at a time, waiting for its images and the web fonts. */
async function settle(send, bounds) {
	await evaluate(
		send,
		`(async () => {
			await document.fonts.ready;
			for (let y = ${bounds.y}; y < ${bounds.y + bounds.height}; y += innerHeight) {
				scrollTo(0, y);
				const deadline = Date.now() + 15000;
				while (Date.now() < deadline && [...document.images].some((img) => {
					const r = img.getBoundingClientRect();
					return r.bottom > 0 && r.top < innerHeight && !img.complete;
				})) await new Promise((r) => setTimeout(r, 200));
			}
			await new Promise((r) => setTimeout(r, 800));
			scrollTo(0, 0);
		})()`
	);
}

async function capture(send, { file, prepare, bounds: expression, fullPage }) {
	if (prepare) await evaluate(send, prepare);
	const bounds = await evaluate(send, expression);
	if (!bounds) throw new Error(`Nothing to capture for ${file}.`);
	await settle(send, bounds);
	const { data } = await send('Page.captureScreenshot', {
		format: 'jpeg',
		quality: 90,
		captureBeyondViewport: fullPage,
		clip: { ...bounds, scale: 1 }
	});
	writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
	console.log(
		`Saved docs/assets/${file} (${Math.round(bounds.width)}×${Math.round(bounds.height)})`
	);
}

async function main() {
	const profile = mkdtempSync(join(tmpdir(), 'vizard-shots-'));
	const page = await openPage(profile);
	try {
		await page.send('Emulation.setDeviceMetricsOverride', {
			...VIEWPORT,
			deviceScaleFactor: 1,
			mobile: false
		});
		await page.send('Page.enable');
		await page.send('Page.addScriptToEvaluateOnNewDocument', {
			source: `localStorage.setItem('flavor', 'latte'); localStorage.setItem('accent', 'peach');`
		});
		await page.send('Page.navigate', { url: `${BASE_URL}/?demo` });
		await waitForDashboard(page.send);
		await evaluate(page.send, PAGE_HELPERS);
		for (const shot of SHOTS) await capture(page.send, shot);
	} finally {
		await page.close().catch(() => {});
		await sleep(500);
		rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
