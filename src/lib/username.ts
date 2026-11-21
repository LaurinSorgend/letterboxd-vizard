/** Turns a typed username, @handle or profile link into a bare lower-case username. */
export function normalizeUsername(input: string): string {
	const trimmed = input.trim();
	const link = /letterboxd\.com\/([^/?#\s]+)/i.exec(trimmed);
	const name = link ? link[1] : trimmed.replace(/^@/, '').replace(/\/+$/, '');
	return name.toLowerCase();
}
