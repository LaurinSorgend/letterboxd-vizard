import { stripDiacritics } from '$lib/text';

export type ImageSize = 'w45' | 'w92' | 'w154' | 'w185' | 'w342' | 'w500';

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

/** Full image URL for a TMDB path at the given width; TheTVDB artwork is already a full URL. */
export function imageUrl(path: string | null, size: ImageSize): string | null {
	if (!path) return null;
	if (path.startsWith('http')) return path;
	return `https://image.tmdb.org/t/p/${size}${path}`;
}

export const tmdbMovieUrl = (id: number): string => `https://www.themoviedb.org/movie/${id}`;

export const tmdbPersonUrl = (id: number): string => `https://www.themoviedb.org/person/${id}`;

export const tmdbCollectionUrl = (id: number): string =>
	`https://www.themoviedb.org/collection/${id}`;

/** Letterboxd redirects this to its own page for the TMDB film. */
export const letterboxdTmdbUrl = (id: number): string => `https://letterboxd.com/tmdb/${id}`;

export const letterboxdFilmUrl = (slug: string): string => `https://letterboxd.com/film/${slug}/`;

export const letterboxdFeedUrl = (username: string): string =>
	`https://letterboxd.com/${username.toLowerCase()}/rss/`;

/** Letterboxd person-page slug: lowercase, diacritics stripped, hyphens. */
function letterboxdSlug(name: string): string {
	return stripDiacritics(name)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export const letterboxdPersonUrl = (kind: 'director' | 'actor', name: string): string =>
	`https://letterboxd.com/${kind}/${letterboxdSlug(name)}/`;
