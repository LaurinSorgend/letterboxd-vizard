/** Full image URL for a TMDB path at the given width; TheTVDB artwork is already a full URL. */
export function imageUrl(path: string | null, size: 'w45' | 'w92' | 'w154' | 'w185'): string | null {
	if (!path) return null;
	if (path.startsWith('http')) return path;
	return `https://image.tmdb.org/t/p/${size}${path}`;
}
