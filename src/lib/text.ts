/** Strips diacritics (e.g. "Amélie" -> "Amelie") via Unicode NFD decomposition. */
export function stripDiacritics(value: string): string {
	return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Case/accent/punctuation-insensitive, so "Amélie" and "amelie" line up. */
export function normalizeTitle(name: string): string {
	return stripDiacritics(name)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}
