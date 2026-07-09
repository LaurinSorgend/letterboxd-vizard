import type { EnrichedFilm } from '$lib/types';

export interface BarDatum {
	label: string;
	count: number;
	avg: number | null;
}

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

function avgRating(films: EnrichedFilm[]): number | null {
	const ratings = films.map((f) => f.rating).filter((r): r is number => r !== null);
	if (ratings.length === 0) return null;
	return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

/** Counts per rating step 0.5–5; steps with no films included. */
export function ratingHistogram(films: EnrichedFilm[]): BarDatum[] {
	const counts = new Map<number, number>();
	for (let r = 0.5; r <= 5; r += 0.5) counts.set(r, 0);
	for (const film of films) {
		if (film.rating !== null) counts.set(film.rating, (counts.get(film.rating) ?? 0) + 1);
	}
	return [...counts].map(([rating, count]) => ({ label: String(rating), count, avg: null }));
}

/** Diary watch events per calendar year, gaps filled with zeros. */
export function watchesPerYear(films: EnrichedFilm[]): BarDatum[] {
	const counts = new Map<number, number>();
	for (const film of films) {
		for (const date of film.watchedDates) {
			const year = Number.parseInt(date.slice(0, 4), 10);
			if (Number.isFinite(year)) counts.set(year, (counts.get(year) ?? 0) + 1);
		}
	}
	if (counts.size === 0) return [];
	const years = [...counts.keys()];
	const result: BarDatum[] = [];
	for (let y = Math.min(...years); y <= Math.max(...years); y++) {
		result.push({ label: String(y), count: counts.get(y) ?? 0, avg: null });
	}
	return result;
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
		.map(([decade, group]) => ({ label: `${decade}s`, count: group.length, avg: avgRating(group) }));
}

export function totalRuntimeMinutes(films: EnrichedFilm[]): number {
	return films.reduce((sum, f) => sum + (f.tmdb?.runtime ?? 0), 0);
}

function grouped(films: EnrichedFilm[], keysOf: (f: EnrichedFilm) => string[]): BarDatum[] {
	const groups = new Map<string, EnrichedFilm[]>();
	for (const film of films) {
		for (const key of new Set(keysOf(film))) {
			(groups.get(key) ?? groups.set(key, []).get(key))!.push(film);
		}
	}
	return [...groups]
		.map(([label, group]) => ({ label, count: group.length, avg: avgRating(group) }))
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

export function byPerson(films: EnrichedFilm[], role: 'directors' | 'cast'): BarDatum[] {
	return grouped(films, (f) => f.tmdb?.[role] ?? []);
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
	return { over: gaps.slice(0, 5).filter((g) => g.gap > 0), under: gaps.slice(-5).filter((g) => g.gap < 0).reverse() };
}
