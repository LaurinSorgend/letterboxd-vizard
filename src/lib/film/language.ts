const names = new Intl.DisplayNames(['en'], { type: 'language' });

/**
 * A language code's English name. Codes that name one language ('iw' and 'he') share it, so
 * anything counted by this name counts that language once. An unknown code is its own name.
 */
export function languageName(code: string): string {
	try {
		return names.of(code) ?? code;
	} catch {
		return code;
	}
}
