import { imageUrl, type ImageSize } from '$lib/film/links';
import type { TmdbMovie } from '$lib/types';

/** A film's poster at `size`, or null when TMDB has none. */
export const posterUrl = (tmdb: TmdbMovie | null, size: ImageSize): string | null =>
	imageUrl(tmdb?.posterPath ?? null, size);
