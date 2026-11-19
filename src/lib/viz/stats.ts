import { getOrCreate } from '$lib/maps';
import { imageUrl, webHref } from '$lib/film/links';
import { libraryMinutes } from '$lib/film/runtime';
import { TMDB } from '$lib/film/ratings';
import { votes } from '$lib/film/votes';
import { releaseYear } from '$lib/film/release';
import { latestWatch } from '$lib/film/diary';
import { DAY_MS, median } from '$lib/math';
import { avgRating, type BarDatum } from '$lib/film/tally';
import type { EnrichedFilm } from '$lib/types';

/** Counts per rating step 0.5–5, each split by whether you hearted it; empty steps included. */
export function ratingHistogram(films: EnrichedFilm[]): BarDatum[] {
	const groups = new Map<number, EnrichedFilm[]>();
	for (let r = 0.5; r <= 5; r += 0.5) groups.set(r, []);
	for (const film of films) {
		if (film.rating !== null) groups.get(film.rating)?.push(film);
	}
	return [...groups].map(([rating, group]) => {
		return {
			key: String(rating),
			label: String(rating),
			count: group.length,
			avg: null,
			highlight: { count: likedCount(group) },
			films: group
		};
	});
}

export const likedCount = (films: EnrichedFilm[]): number =>
	films.filter((film) => film.liked).length;

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
			key: String(y),
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
			key: film.uri,
			label: film.name,
			count: Math.max(1, film.watchedDates.length),
			avg: film.rating,
			image: imageUrl(film.tmdb?.posterPath ?? null, 'w92'),
			imageLarge: imageUrl(film.tmdb?.posterPath ?? null, 'w185'),
			href: webHref(film.uri),
			films: [film]
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export interface RecentWatch {
	film: EnrichedFilm;
	date: string;
	rating: number | null;
}

const RECENT_WATCHES = 10;

/** The latest diary-logged films, each at its latest watch, newest first. */
export function recentWatches(films: EnrichedFilm[]): RecentWatch[] {
	return films
		.flatMap((film) => {
			const date = latestWatch(film);
			if (date === null) return [];
			const entry = film.entries.find((e) => e.date === date);
			return [{ film, date, rating: entry?.rating ?? film.rating }];
		})
		.sort((a, b) => b.date.localeCompare(a.date) || a.film.name.localeCompare(b.film.name))
		.slice(0, RECENT_WATCHES);
}

export function releaseDecades(films: EnrichedFilm[]): BarDatum[] {
	const groups = new Map<number, EnrichedFilm[]>();
	for (const film of films) {
		const year = releaseYear(film);
		if (year === null) continue;
		const decade = Math.floor(year / 10) * 10;
		getOrCreate(groups, decade, () => []).push(film);
	}
	return [...groups]
		.sort(([a], [b]) => a - b)
		.map(([decade, group]) => ({
			key: `${decade}s`,
			label: `${decade}s`,
			count: group.length,
			avg: avgRating(group),
			films: group
		}));
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
		key: band.label,
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
	return banded(films, RUNTIME_BANDS, (film) => libraryMinutes(film) || null);
}

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
	return median(films.map(daysToFirstWatch).filter((value): value is number => value !== null));
}

/*
 * A combined TMDB + IMDb vote count stands in for how widely a film has been seen. Without an
 * OMDb key this is just TMDB's own count, so the bands still read sensibly on TMDB alone; with
 * one, IMDb's much larger audience dominates the sum for anything mainstream, which is why the
 * top band stays a wide-open "15k+" rather than gaining more resolution above it.
 */
const AUDIENCE_BANDS: Band[] = [
	{ label: '< 100', below: 100 },
	{ label: '100–999', below: 1_000 },
	{ label: '1k–4.9k', below: 5_000 },
	{ label: '5k–14.9k', below: 15_000 },
	{ label: '15k+', below: Infinity }
];

/** Films per combined TMDB + IMDb vote-count band, least-seen band first. */
export function audienceBands(films: EnrichedFilm[]): BarDatum[] {
	return banded(films, AUDIENCE_BANDS, (film) => votes(film) || null);
}
