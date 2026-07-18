import { imageUrl } from './images';
import type { EnrichedFilm } from '$lib/types';

export interface BarDatum {
	label: string;
	count: number;
	avg: number | null;
	image?: string | null;
	imageLarge?: string | null;
	href?: string;
	films: EnrichedFilm[];
}

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

/** Mean of the non-null ratings, or null if nothing is rated. */
export function avgRating(films: EnrichedFilm[]): number | null {
	const ratings = films.map((f) => f.rating).filter((r): r is number => r !== null);
	if (ratings.length === 0) return null;
	return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

/** Counts per rating step 0.5–5; steps with no films included. */
export function ratingHistogram(films: EnrichedFilm[]): BarDatum[] {
	const groups = new Map<number, EnrichedFilm[]>();
	for (let r = 0.5; r <= 5; r += 0.5) groups.set(r, []);
	for (const film of films) {
		if (film.rating !== null) groups.get(film.rating)?.push(film);
	}
	return [...groups].map(([rating, group]) => ({
		label: String(rating),
		count: group.length,
		avg: null,
		films: group
	}));
}

/** Diary watch events per calendar year, gaps filled with zeros. */
export function watchesPerYear(films: EnrichedFilm[]): BarDatum[] {
	const counts = new Map<number, number>();
	const groups = new Map<number, Set<EnrichedFilm>>();
	for (const film of films) {
		for (const date of film.watchedDates) {
			const year = Number.parseInt(date.slice(0, 4), 10);
			if (!Number.isFinite(year)) continue;
			counts.set(year, (counts.get(year) ?? 0) + 1);
			(groups.get(year) ?? groups.set(year, new Set()).get(year))!.add(film);
		}
	}
	if (counts.size === 0) return [];
	const years = [...counts.keys()];
	const result: BarDatum[] = [];
	for (let y = Math.min(...years); y <= Math.max(...years); y++) {
		result.push({
			label: String(y),
			count: counts.get(y) ?? 0,
			avg: null,
			films: [...(groups.get(y) ?? [])]
		});
	}
	return result;
}

/**
 * Films seen more than once, most-logged first. A film whose only diary entry is flagged as a
 * rewatch counts: Letterboxd is reporting a watch that predates the diary, so `count` (logged
 * entries, at least one) understates those films rather than inventing a number for them.
 */
export function mostRewatched(films: EnrichedFilm[]): BarDatum[] {
	return films
		.filter((film) => film.watchedDates.length > 1 || film.rewatch)
		.map((film) => ({
			label: film.name,
			count: Math.max(1, film.watchedDates.length),
			avg: film.rating,
			image: imageUrl(film.tmdb?.posterPath ?? null, 'w92'),
			imageLarge: imageUrl(film.tmdb?.posterPath ?? null, 'w185'),
			href: film.uri,
			films: [film]
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Films per release decade. */
export function releaseDecades(films: EnrichedFilm[]): BarDatum[] {
	const groups = new Map<number, EnrichedFilm[]>();
	for (const film of films) {
		const year = film.tmdb?.year ?? film.year;
		if (year === null) continue;
		const decade = Math.floor(year / 10) * 10;
		(groups.get(decade) ?? groups.set(decade, []).get(decade))!.push(film);
	}
	return [...groups]
		.sort(([a], [b]) => a - b)
		.map(([decade, group]) => ({
			label: `${decade}s`,
			count: group.length,
			avg: avgRating(group),
			films: group
		}));
}

export function totalRuntimeMinutes(films: EnrichedFilm[]): number {
	return films.reduce((sum, f) => sum + (f.tmdb?.runtime ?? 0), 0);
}

/* Runtime bands in minutes; the last catches everything from 3h up. */
const RUNTIME_BANDS: { label: string; below: number }[] = [
	{ label: '< 80m', below: 80 },
	{ label: '80–99m', below: 100 },
	{ label: '100–119m', below: 120 },
	{ label: '120–149m', below: 150 },
	{ label: '150–179m', below: 180 },
	{ label: '3h+', below: Infinity }
];

/** Films per runtime band. Series carry whole-run lengths, so a short one lands among films. */
export function runtimeBuckets(films: EnrichedFilm[]): BarDatum[] {
	const groups = RUNTIME_BANDS.map((): EnrichedFilm[] => []);
	for (const film of films) {
		const runtime = film.tmdb?.runtime;
		if (!runtime) continue;
		groups[RUNTIME_BANDS.findIndex((band) => runtime < band.below)].push(film);
	}
	return RUNTIME_BANDS.map((band, i) => ({
		label: band.label,
		count: groups[i].length,
		avg: avgRating(groups[i]),
		films: groups[i]
	}));
}

function grouped(films: EnrichedFilm[], keysOf: (f: EnrichedFilm) => string[]): BarDatum[] {
	const groups = new Map<string, EnrichedFilm[]>();
	for (const film of films) {
		for (const key of new Set(keysOf(film))) {
			(groups.get(key) ?? groups.set(key, []).get(key))!.push(film);
		}
	}
	return [...groups]
		.map(([label, group]) => ({ label, count: group.length, avg: avgRating(group), films: group }))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function byGenre(films: EnrichedFilm[]): BarDatum[] {
	return grouped(films, (f) => f.tmdb?.genres ?? []);
}

export function byLanguage(films: EnrichedFilm[]): BarDatum[] {
	return grouped(films, (f) => {
		if (!f.tmdb?.originalLanguage) return [];
		try {
			return [languageNames.of(f.tmdb.originalLanguage) ?? f.tmdb.originalLanguage];
		} catch {
			return [f.tmdb.originalLanguage];
		}
	});
}

/** Letterboxd person-page slug: lowercase, diacritics stripped, hyphens. */
function letterboxdSlug(name: string): string {
	return name
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function byPerson(films: EnrichedFilm[], role: 'directors' | 'cast'): BarDatum[] {
	// Group on tmdbId, not name: TMDB has several people sharing a name, and pooling them would
	// merge their films, counts and averages into one bogus bar. People without an id (rare) keep
	// grouping by name, the best we can do for them.
	interface PersonGroup {
		name: string;
		tmdbId: number | null;
		films: EnrichedFilm[];
		profilePath: string | null;
	}
	const groups = new Map<string, PersonGroup>();
	for (const film of films) {
		const seen = new Set<string>();
		for (const person of film.tmdb?.[role] ?? []) {
			const key = person.tmdbId !== null ? `id:${person.tmdbId}` : `name:${person.name}`;
			if (seen.has(key)) continue;
			seen.add(key);
			let group = groups.get(key);
			if (!group) {
				group = { name: person.name, tmdbId: person.tmdbId, films: [], profilePath: null };
				groups.set(key, group);
			}
			group.profilePath ??= person.profilePath;
			group.films.push(film);
		}
	}

	// A bare name-slug lands on whoever owns it on Letterboxd, so it is only safe when the name is
	// unique in this library; anyone sharing a name here links to their unambiguous TMDB page instead.
	const nameCounts = new Map<string, number>();
	for (const { name } of groups.values()) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);

	const kind = role === 'directors' ? 'director' : 'actor';
	return [...groups.values()]
		.map((group) => ({
			label: group.name,
			count: group.films.length,
			avg: avgRating(group.films),
			image: imageUrl(group.profilePath, 'w45'),
			imageLarge: imageUrl(group.profilePath, 'w185'),
			href:
				group.tmdbId !== null && (nameCounts.get(group.name) ?? 0) > 1
					? `https://www.themoviedb.org/person/${group.tmdbId}`
					: `https://letterboxd.com/${kind}/${letterboxdSlug(group.name)}/`,
			films: group.films
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export interface RatingGap {
	film: EnrichedFilm;
	yours: number;
	tmdb: number;
	gap: number;
}

/** Films rated most above/below the TMDB average (TMDB's 10-scale halved). */
export function ratingGaps(films: EnrichedFilm[]): { over: RatingGap[]; under: RatingGap[] } {
	const gaps: RatingGap[] = [];
	for (const film of films) {
		if (film.rating === null || !film.tmdb?.voteAverage) continue;
		const tmdb = film.tmdb.voteAverage / 2;
		gaps.push({ film, yours: film.rating, tmdb, gap: film.rating - tmdb });
	}
	gaps.sort((a, b) => b.gap - a.gap);
	return {
		over: gaps.slice(0, 5).filter((g) => g.gap > 0),
		under: gaps
			.slice(-5)
			.filter((g) => g.gap < 0)
			.reverse()
	};
}
