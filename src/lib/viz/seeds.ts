import { effectiveCountries } from './countries';
import type { EnrichedFilm, Seed } from '$lib/types';

const MAX_PER_DECADE = 4;
const MAX_PER_COUNTRY = 6;

function shuffled<T>(items: T[]): T[] {
	const arr = [...items];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function toSeed(film: EnrichedFilm): Seed {
	return { tmdbId: film.tmdb!.tmdbId, rating: film.rating ?? 3 };
}

/** TMDB ids of watched films with a real TMDB record (negative ids are TheTVDB). */
export function watchedTmdbIds(films: EnrichedFilm[]): number[] {
	return films.filter((f) => f.tmdb && f.tmdb.tmdbId > 0).map((f) => f.tmdb!.tmdbId);
}

/**
 * Random sample of well-rated movies capped per release decade and per
 * country, so the seeds (and thus the recommendations) vary between visits
 * and don't all come from one era or one film industry.
 */
export function pickDiverseSeeds(films: EnrichedFilm[], count: number): Seed[] {
	const pool = shuffled(
		films.filter(
			(f) =>
				f.rating !== null && f.rating >= 3.5 && f.tmdb?.mediaType === 'movie' && f.tmdb.tmdbId > 0
		)
	);
	const perDecade = new Map<number, number>();
	const perCountry = new Map<string, number>();
	const picked: EnrichedFilm[] = [];
	const passedOver: EnrichedFilm[] = [];
	for (const film of pool) {
		if (picked.length >= count) break;
		const decade = Math.floor((film.tmdb!.year ?? film.year ?? 0) / 10);
		const country = effectiveCountries(film.tmdb!)[0] ?? '??';
		if (
			(perDecade.get(decade) ?? 0) >= MAX_PER_DECADE ||
			(perCountry.get(country) ?? 0) >= MAX_PER_COUNTRY
		) {
			passedOver.push(film);
			continue;
		}
		perDecade.set(decade, (perDecade.get(decade) ?? 0) + 1);
		perCountry.set(country, (perCountry.get(country) ?? 0) + 1);
		picked.push(film);
	}
	picked.push(...passedOver.slice(0, Math.max(0, count - picked.length)));
	return picked.map(toSeed);
}

/** Random sample of a country's watched movies, liked ones only. */
export function pickCountrySeeds(films: EnrichedFilm[], count: number): Seed[] {
	const pool = films.filter(
		(f) =>
			f.tmdb?.mediaType === 'movie' &&
			f.tmdb.tmdbId > 0 &&
			(f.rating === null || f.rating >= 3)
	);
	return shuffled(pool).slice(0, count).map(toSeed);
}
