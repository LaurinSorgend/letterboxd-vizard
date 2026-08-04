import { imageUrl } from './images';
import { getOrCreate } from '$lib/collections';
import { stripDiacritics } from '$lib/text';
import type { Collection, EnrichedFilm } from '$lib/types';

export interface BarDatum {
	label: string;
	count: number;
	avg: number | null;
	/** A subset of `films`, drawn as its own segment of the bar. */
	highlight?: { count: number; films: EnrichedFilm[] };
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

/** Counts per rating step 0.5–5, each split by whether you hearted it; empty steps included. */
export function ratingHistogram(films: EnrichedFilm[]): BarDatum[] {
	const groups = new Map<number, EnrichedFilm[]>();
	for (let r = 0.5; r <= 5; r += 0.5) groups.set(r, []);
	for (const film of films) {
		if (film.rating !== null) groups.get(film.rating)?.push(film);
	}
	return [...groups].map(([rating, group]) => {
		const liked = group.filter((film) => film.liked);
		return {
			label: String(rating),
			count: group.length,
			avg: null,
			highlight: { count: liked.length, films: liked },
			films: group
		};
	});
}

/** Films you hearted, and how many of those you left unrated. */
export function likeTotals(films: EnrichedFilm[]): { liked: number; unrated: number } {
	const liked = films.filter((film) => film.liked);
	return { liked: liked.length, unrated: liked.filter((film) => film.rating === null).length };
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
			getOrCreate(groups, year, () => new Set<EnrichedFilm>()).add(film);
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
		getOrCreate(groups, decade, () => []).push(film);
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

export interface Streak {
	days: number;
	start: string;
	end: string;
}

const DAY_MS_STREAK = 24 * 60 * 60 * 1000;

/** The longest run of consecutive calendar days in a set of ISO dates, or null if empty. */
export function longestRun(dates: string[]): Streak | null {
	const days = [...new Set(dates)].sort();
	if (days.length === 0) return null;
	let best: Streak = { days: 1, start: days[0], end: days[0] };
	let run = 1;
	for (let i = 1; i < days.length; i++) {
		run = (Date.parse(days[i]) - Date.parse(days[i - 1])) / DAY_MS_STREAK === 1 ? run + 1 : 1;
		if (run > best.days) best = { days: run, start: days[i - run + 1], end: days[i] };
	}
	return best;
}

/** An ordered bucket holding everything below `below` that no earlier band took. */
interface Band {
	label: string;
	below: number;
}

/** Films bucketed into ordered bands by a measure; films the measure returns null for drop out. */
function banded(
	films: EnrichedFilm[],
	bands: Band[],
	measure: (film: EnrichedFilm) => number | null
): BarDatum[] {
	const groups = bands.map((): EnrichedFilm[] => []);
	for (const film of films) {
		const value = measure(film);
		if (value === null) continue;
		groups[bands.findIndex((band) => value < band.below)].push(film);
	}
	return bands.map((band, i) => ({
		label: band.label,
		count: groups[i].length,
		avg: avgRating(groups[i]),
		films: groups[i]
	}));
}

/* Runtime bands in minutes; the last catches everything from 3h up. */
const RUNTIME_BANDS: Band[] = [
	{ label: '< 80m', below: 80 },
	{ label: '80–99m', below: 100 },
	{ label: '100–119m', below: 120 },
	{ label: '120–149m', below: 150 },
	{ label: '150–179m', below: 180 },
	{ label: '3h+', below: Infinity }
];

/** Films per runtime band. Series carry whole-run lengths, so a short one lands among films. */
export function runtimeBuckets(films: EnrichedFilm[]): BarDatum[] {
	return banded(films, RUNTIME_BANDS, (film) => film.tmdb?.runtime || null);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/* Gap bands in days between release and first watch; the last catches everything from 25y up. */
const LAG_BANDS: Band[] = [
	{ label: '< 1 month', below: 30 },
	{ label: '1–6 months', below: 183 },
	{ label: '6–12 months', below: 365 },
	{ label: '1–3 years', below: 3 * 365 },
	{ label: '3–10 years', below: 10 * 365 },
	{ label: '10–25 years', below: 25 * 365 },
	{ label: '25 years+', below: Infinity }
];

/**
 * Days between a film's release and the first time you logged it, or null when either date is
 * missing. Festival and regional screenings can predate TMDB's date, so those count as day zero.
 */
function daysToFirstWatch(film: EnrichedFilm): number | null {
	const released = film.tmdb?.releaseDate;
	if (!released) return null;
	const releasedAt = Date.parse(released);
	const watches = film.watchedDates.map((date) => Date.parse(date)).filter(Number.isFinite);
	if (!Number.isFinite(releasedAt) || watches.length === 0) return null;
	return Math.max(0, (Math.min(...watches) - releasedAt) / DAY_MS);
}

/** Films per gap between release and first diary entry. */
export function watchLag(films: EnrichedFilm[]): BarDatum[] {
	return banded(films, LAG_BANDS, daysToFirstWatch);
}

/** Median days between release and first watch, or null if no film has both dates. */
export function medianWatchLag(films: EnrichedFilm[]): number | null {
	const days = films
		.map(daysToFirstWatch)
		.filter((value): value is number => value !== null)
		.sort((a, b) => a - b);
	return days.length === 0 ? null : days[Math.floor(days.length / 2)];
}

/** A day count as a rough span: "12 days", "5 months", "3.2 years". */
export function formatDays(days: number): string {
	if (days < 60) return `${Math.round(days)} days`;
	if (days < 365) return `${Math.round(days / 30)} months`;
	return `${(days / 365).toFixed(1)} years`;
}

/*
 * TMDB vote count stands in for how widely a film has been seen. Its scale is far smaller than
 * IMDb's (even the most-rated films sit in the low tens of thousands), so the top band starts
 * at 15k rather than the six figures an IMDb-shaped guess would suggest.
 */
const AUDIENCE_BANDS: Band[] = [
	{ label: '< 100', below: 100 },
	{ label: '100–999', below: 1_000 },
	{ label: '1k–4.9k', below: 5_000 },
	{ label: '5k–14.9k', below: 15_000 },
	{ label: '15k+', below: Infinity }
];

/** Films per TMDB vote-count band, least-seen band first. */
export function audienceBands(films: EnrichedFilm[]): BarDatum[] {
	return banded(films, AUDIENCE_BANDS, (film) => film.tmdb?.voteCount ?? null);
}

/** Share (0–1) of films with a vote count that fall under `below`, or null if none have one. */
export function obscurityShare(films: EnrichedFilm[], below = 1_000): number | null {
	const counts = films
		.map((film) => film.tmdb?.voteCount)
		.filter((count): count is number => count !== null && count !== undefined);
	return counts.length === 0
		? null
		: counts.filter((count) => count < below).length / counts.length;
}

/** Films grouped by every key they carry, count-desc; a film counts once per distinct key. */
export function grouped(films: EnrichedFilm[], keysOf: (f: EnrichedFilm) => string[]): BarDatum[] {
	const groups = new Map<string, EnrichedFilm[]>();
	for (const film of films) {
		for (const key of new Set(keysOf(film))) {
			getOrCreate(groups, key, () => []).push(film);
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
	return stripDiacritics(name)
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
			const group = getOrCreate(groups, key, () => ({
				name: person.name,
				tmdbId: person.tmdbId,
				films: [],
				profilePath: null
			}));
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
			image: imageUrl(group.profilePath, 'w92'),
			imageLarge: imageUrl(group.profilePath, 'w185'),
			href:
				group.tmdbId !== null && (nameCounts.get(group.name) ?? 0) > 1
					? `https://www.themoviedb.org/person/${group.tmdbId}`
					: `https://letterboxd.com/${kind}/${letterboxdSlug(group.name)}/`,
			films: group.films
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Franchises you have seen more than one film of, most-watched first. A single film from a
 * collection says nothing about following the franchise, so those groups drop out.
 */
export function byCollection(films: EnrichedFilm[]): BarDatum[] {
	const groups = new Map<number, { collection: Collection; films: EnrichedFilm[] }>();
	for (const film of films) {
		const collection = film.tmdb?.collection;
		if (!collection) continue;
		getOrCreate(groups, collection.id, () => ({ collection, films: [] })).films.push(film);
	}
	return [...groups.values()]
		.filter((group) => group.films.length > 1)
		.map(({ collection, films: group }) => ({
			// TMDB names every franchise "<name> Collection", which reads as noise once they are a list.
			label: collection.name.replace(/ Collection$/, ''),
			count: group.length,
			avg: avgRating(group),
			image: imageUrl(collection.posterPath, 'w92'),
			imageLarge: imageUrl(collection.posterPath, 'w185'),
			href: `https://www.themoviedb.org/collection/${collection.id}`,
			films: group
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** How many TMDB-matched films belong to any franchise at all, and how many were matched. */
export function collectionShare(films: EnrichedFilm[]): { inCollection: number; total: number } {
	const matched = films.filter((film) => film.tmdb);
	return {
		inCollection: matched.filter((film) => film.tmdb?.collection).length,
		total: matched.length
	};
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
