import { count } from '$lib/format';
import { webHref } from '$lib/viz/href';
import type { BarDatum } from '$lib/viz/stats';
import type { EnrichedFilm } from '$lib/types';

/** Scene hues, defined as CSS custom properties in wrapped.css and flipped per theme. */
export type Accent =
	'neutral' | 'amber' | 'oxblood' | 'cyan' | 'indigo' | 'forest' | 'magenta' | 'gold';

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
	body: SceneBody;
}

export { count, percent } from '$lib/format';

export const stars = (rating: number | null): string =>
	rating === null ? '—' : `★ ${rating.toFixed(1)}`;
export const plural = (n: number, one: string, many = `${one}s`): string =>
	`${count(n)} ${n === 1 ? one : many}`;

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

export function runtimeLabel(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	return hours === 0 ? `${minutes}m` : `${hours}h ${minutes % 60}m`;
}
