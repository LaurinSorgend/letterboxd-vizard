import { readPref, removePref, writePref } from '$lib/prefs';

/*
 * The theme is applied twice: by the inline script in src/app.html, which runs before first paint
 * and so cannot import this module, and by ThemeSwitch afterwards. theme.test.ts checks that
 * app.html and the selectors in app.css agree with the lists below.
 */

/** localStorage keys, read by app.html too. */
export const FLAVOR_KEY = 'flavor';
export const ACCENT_KEY = 'accent';

/** Catppuccin flavours. With none saved the page follows the system's light or dark scheme. */
export const FLAVORS = [
	{ value: 'latte', label: 'Latte' },
	{ value: 'frappe', label: 'Frappé' },
	{ value: 'macchiato', label: 'Macchiato' },
	{ value: 'mocha', label: 'Mocha' }
] as const;

export const SYSTEM_FLAVOR = 'system';

export const ACCENTS = [
	{ value: 'rosewater', label: 'Rosewater' },
	{ value: 'flamingo', label: 'Flamingo' },
	{ value: 'pink', label: 'Pink' },
	{ value: 'mauve', label: 'Mauve' },
	{ value: 'red', label: 'Red' },
	{ value: 'maroon', label: 'Maroon' },
	{ value: 'peach', label: 'Peach' },
	{ value: 'yellow', label: 'Yellow' },
	{ value: 'green', label: 'Green' },
	{ value: 'teal', label: 'Teal' },
	{ value: 'sky', label: 'Sky' },
	{ value: 'sapphire', label: 'Sapphire' },
	{ value: 'blue', label: 'Blue' },
	{ value: 'lavender', label: 'Lavender' }
] as const;

/** The accent app.css gives the page with no `data-accent`, so it is never saved. */
export const DEFAULT_ACCENT = 'blue';

const listed = (options: readonly { value: string }[], value: string | null): value is string =>
	options.some((option) => option.value === value);

export function savedFlavor(): string {
	const saved = readPref(FLAVOR_KEY);
	return listed(FLAVORS, saved) ? saved : SYSTEM_FLAVOR;
}

export function savedAccent(): string {
	const saved = readPref(ACCENT_KEY);
	return listed(ACCENTS, saved) ? saved : DEFAULT_ACCENT;
}

export function applyFlavor(value: string): void {
	if (value === SYSTEM_FLAVOR) {
		removePref(FLAVOR_KEY);
		delete document.documentElement.dataset.flavor;
	} else {
		writePref(FLAVOR_KEY, value);
		document.documentElement.dataset.flavor = value;
	}
}

export function applyAccent(value: string): void {
	if (value === DEFAULT_ACCENT) {
		removePref(ACCENT_KEY);
		delete document.documentElement.dataset.accent;
	} else {
		writePref(ACCENT_KEY, value);
		document.documentElement.dataset.accent = value;
	}
}

/**
 * Calls `onChange` whenever the colours on screen may have changed: a picked flavour or accent,
 * or the system scheme flipping under the default flavour. Returns the unsubscribe.
 */
export function onThemeChange(onChange: () => void): () => void {
	const scheme = matchMedia('(prefers-color-scheme: dark)');
	scheme.addEventListener('change', onChange);
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-flavor', 'data-accent']
	});
	return () => {
		scheme.removeEventListener('change', onChange);
		observer.disconnect();
	};
}
