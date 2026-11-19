import { webHref } from '$lib/film/links';
import type { BarDatum } from '$lib/film/tally';
import { POSTER_ROW, type Accent } from '../look';
import type { Year } from '$lib/year';
import type { EnrichedFilm } from '$lib/types';

/** What every frame is built from: the year, its verdict, and whose year it was. */
export interface DeckInput extends Year {
	viewer: string | null;
}

export interface Poster {
	name: string;
	path: string | null;
	href: string | null;
	meta: string;
}

export interface Bar {
	label: string;
	value: string;
	/** 0–1 of the largest bar in the set, so the row is comparable at a glance. */
	share: number;
}

export interface Stat {
	label: string;
	value: string;
}

export type SceneBody =
	| { kind: 'none' }
	| { kind: 'bars'; bars: Bar[] }
	| { kind: 'posters'; posters: Poster[] }
	| { kind: 'summary' }
	| { kind: 'gate'; count: number; expanded: boolean };

export interface Scene {
	id: string;
	accent: Accent;
	/** The frame's heading. The showcase value below it is the datum, not a second heading. */
	label: string;
	value: string;
	/** Drives the value's size: long names need a smaller cut than a three-digit count. */
	valueKind: 'number' | 'name';
	note: string;
	stats: Stat[];
	/** A quiet line under the note: the also-true labels, or anything else that is not a stat. */
	footnote?: string;
	/** Something behind the frame rather than in it, for a frame that asks for one. */
	backdrop?: 'rain';
	body: SceneBody;
}

/** The first `POSTER_ROW` films as posters; count the whole list, not the row. */
export function posterRow(films: EnrichedFilm[], meta: (film: EnrichedFilm) => string): Poster[] {
	return films.slice(0, POSTER_ROW).map((film) => posterOf(film, meta(film)));
}

export function posterOf(film: EnrichedFilm, meta: string): Poster {
	return {
		name: film.name,
		path: film.tmdb?.posterPath ?? null,
		href: webHref(film.uri),
		meta
	};
}

export function barsFrom(data: BarDatum[]): Bar[] {
	const top = data[0]?.count ?? 1;
	return data.map((datum) => ({
		label: datum.label,
		value: String(datum.count),
		share: datum.count / top
	}));
}
