import { isTmdbMovie, type EnrichedFilm, type TmdbMovie } from '$lib/types';

const FAVOURITE_RATING = 4;
const LIKED_UNRATED_RATING = 4;
const RATING_OFFSET = 2.5;
const MIN_WEIGHT = 0.5;
const AFFINITY_HALF = 2;
const MIN_CAST_SUPPORT = 2;
const MIN_KEYWORD_SUPPORT = 2;
const MIN_KEYWORD_SUPPORT_LARGE = 3;
const LARGE_FAVOURITE_COUNT = 200;
const MAX_KEYWORD_SHARE = 0.1;
const MIN_CANDIDATE_CAST = 3;
const TOP_CAST_TERMS = 3;
const TOP_KEYWORD_TERMS = 5;
const KEYWORD_SCALE = 2.5;
const WEIGHT_DIRECTOR = 0.4;
const WEIGHT_CAST = 0.2;
const WEIGHT_KEYWORD = 0.25;
const WEIGHT_COLLECTION = 0.15;
/** Lowest score a recommendation may have. */
export const THRESHOLD = 0.2;
/** Most recommendations returned. */
export const MAX_RESULTS = 20;
const TOP_DIRECTORS = 20;
const TOP_CAST = 10;
const REASON_CAST_NAMES = 2;
const REASON_KEYWORDS = 3;

/** Final per-feature affinities derived from a viewer's favourite films. */
export interface TasteProfile {
	directors: Map<number, number>;
	cast: Map<number, number>;
	keywords: Map<string, number>;
	collections: Set<number>;
}

/** An upcoming film with its similarity score and a short reason. */
export interface ScoredFilm {
	record: TmdbMovie;
	score: number;
	reason: string;
}

interface Tally<K> {
	sum: Map<K, number>;
	support: Map<K, number>;
}

interface Favourite {
	tmdb: TmdbMovie;
	weight: number;
}

const affinity = (s: number): number => s / (s + AFFINITY_HALF);

const billing = (i: number): number => 1 / Math.sqrt(1 + i);

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

const tally = <K>(): Tally<K> => ({ sum: new Map(), support: new Map() });

function add<K>(map: Map<K, number>, key: K, value: number): void {
	map.set(key, (map.get(key) ?? 0) + value);
}

function favouriteWeight(film: EnrichedFilm): number | null {
	const isFavourite = (film.rating !== null && film.rating >= FAVOURITE_RATING) || film.liked;
	if (!isFavourite) return null;
	const r = film.rating ?? LIKED_UNRATED_RATING;
	return Math.max(MIN_WEIGHT, r - RATING_OFFSET);
}

function favourites(films: EnrichedFilm[]): Favourite[] {
	return films.flatMap((film) => {
		if (!isTmdbMovie(film.tmdb)) return [];
		const weight = favouriteWeight(film);
		return weight === null ? [] : [{ tmdb: film.tmdb, weight }];
	});
}

function keywordCounts(library: TmdbMovie[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const record of library) {
		for (const k of new Set(record.keywords)) add(counts, k, 1);
	}
	return counts;
}

function idf(libSize: number, n: number): number {
	if (libSize <= 2) return 0;
	return clamp01(Math.log(libSize / n) / Math.log(libSize / 2));
}

function tallyFavourite(
	fav: Favourite,
	sums: { dir: Map<number, number>; cast: Tally<number>; kw: Tally<string> }
): void {
	for (const d of fav.tmdb.directors) {
		if (d.tmdbId !== null) add(sums.dir, d.tmdbId, fav.weight);
	}
	fav.tmdb.cast.forEach((c, i) => {
		if (c.tmdbId !== null) add(sums.cast.sum, c.tmdbId, fav.weight * billing(i));
	});
	for (const id of new Set(fav.tmdb.cast.flatMap((c) => (c.tmdbId === null ? [] : [c.tmdbId])))) {
		add(sums.cast.support, id, 1);
	}
	for (const k of fav.tmdb.keywords) add(sums.kw.sum, k, fav.weight);
	for (const k of new Set(fav.tmdb.keywords)) add(sums.kw.support, k, 1);
}

function castAffinities(cast: Tally<number>): Map<number, number> {
	const out = new Map<number, number>();
	for (const [id, s] of cast.sum) {
		if ((cast.support.get(id) ?? 0) >= MIN_CAST_SUPPORT) out.set(id, affinity(s));
	}
	return out;
}

function keywordAffinities(
	kw: Tally<string>,
	library: TmdbMovie[],
	favouriteCount: number
): Map<string, number> {
	const L = library.length;
	const counts = keywordCounts(library);
	const minSupport =
		favouriteCount > LARGE_FAVOURITE_COUNT ? MIN_KEYWORD_SUPPORT_LARGE : MIN_KEYWORD_SUPPORT;
	const out = new Map<string, number>();
	for (const [k, s] of kw.sum) {
		const n = counts.get(k) ?? 0;
		if ((kw.support.get(k) ?? 0) < minSupport || n === 0 || n / L > MAX_KEYWORD_SHARE) continue;
		out.set(k, affinity(s) * idf(L, n));
	}
	return out;
}

/** Builds director, cast, keyword and series affinities from the viewer's favourite movies. */
export function buildTasteProfile(films: EnrichedFilm[]): TasteProfile {
	const library = films.flatMap((f) => (isTmdbMovie(f.tmdb) ? [f.tmdb] : []));
	const favs = favourites(films);
	const sums = { dir: new Map<number, number>(), cast: tally<number>(), kw: tally<string>() };
	for (const fav of favs) tallyFavourite(fav, sums);
	const directors = new Map([...sums.dir].map(([id, s]) => [id, affinity(s)] as const));
	const collections = new Set(
		favs.flatMap((f) => (f.tmdb.collection ? [f.tmdb.collection.id] : []))
	);
	return {
		directors,
		cast: castAffinities(sums.cast),
		keywords: keywordAffinities(sums.kw, library, favs.length),
		collections
	};
}

function topIds(map: Map<number, number>, count: number): number[] {
	return [...map]
		.sort((a, b) => b[1] - a[1])
		.slice(0, count)
		.map(([id]) => id);
}

/** Top directors then top cast by affinity, deduped, for looking up their upcoming films. */
export function topPeople(profile: TasteProfile): number[] {
	const ids = [...topIds(profile.directors, TOP_DIRECTORS), ...topIds(profile.cast, TOP_CAST)];
	return [...new Set(ids)];
}

interface Term<T> {
	label: T;
	value: number;
}

const byValueDesc = <T>(a: Term<T>, b: Term<T>): number => b.value - a.value;

const sumOf = (terms: Term<unknown>[]): number => terms.reduce((acc, t) => acc + t.value, 0);

function directorTerms(profile: TasteProfile, record: TmdbMovie): Term<string>[] {
	return record.directors
		.flatMap((d) => {
			const a = d.tmdbId === null ? undefined : profile.directors.get(d.tmdbId);
			return a === undefined ? [] : [{ label: d.name, value: a }];
		})
		.sort(byValueDesc);
}

function castTerms(profile: TasteProfile, record: TmdbMovie): Term<string>[] {
	return record.cast
		.flatMap((c, i) => {
			const a = c.tmdbId === null ? undefined : profile.cast.get(c.tmdbId);
			return a === undefined ? [] : [{ label: c.name, value: billing(i) * a }];
		})
		.sort(byValueDesc)
		.slice(0, TOP_CAST_TERMS);
}

function keywordTerms(profile: TasteProfile, record: TmdbMovie): Term<string>[] {
	return [...new Set(record.keywords)]
		.flatMap((k) => {
			const v = profile.keywords.get(k);
			return v === undefined ? [] : [{ label: k, value: v }];
		})
		.sort(byValueDesc)
		.slice(0, TOP_KEYWORD_TERMS);
}

interface Components {
	D: number;
	C: number;
	K: number;
	G: number;
	directors: Term<string>[];
	cast: Term<string>[];
	keywords: Term<string>[];
}

function components(profile: TasteProfile, record: TmdbMovie): Components {
	const directors = directorTerms(profile, record);
	const cast = castTerms(profile, record);
	const keywords = keywordTerms(profile, record);
	const inSeries = record.collection !== null && profile.collections.has(record.collection.id);
	return {
		D: directors[0]?.value ?? 0,
		C: Math.min(1, sumOf(cast)),
		K: Math.min(1, sumOf(keywords) / KEYWORD_SCALE),
		G: inSeries ? 1 : 0,
		directors,
		cast,
		keywords
	};
}

const combine = (c: Components): number =>
	WEIGHT_DIRECTOR * c.D + WEIGHT_CAST * c.C + WEIGHT_KEYWORD * c.K + WEIGHT_COLLECTION * c.G;

const labels = (terms: Term<string>[], count: number): string =>
	terms
		.slice(0, count)
		.map((t) => t.label)
		.join(', ');

function reasonFor(c: Components): string {
	const parts: string[] = [];
	if (c.D > 0) parts.push(`Director ${c.directors[0].label}`);
	if (c.C > 0) parts.push(`cast ${labels(c.cast, REASON_CAST_NAMES)}`);
	if (c.K > 0) parts.push(`keywords: ${labels(c.keywords, REASON_KEYWORDS)}`);
	if (c.G) parts.push('same series as a favourite');
	return parts.join(' · ');
}

const isCandidate = (record: TmdbMovie, exclude: ReadonlySet<number>): boolean =>
	!exclude.has(record.tmdbId) &&
	record.directors.length > 0 &&
	record.cast.length >= MIN_CANDIDATE_CAST;

/** Scores upcoming films against the profile; returns the best matches above the threshold. */
export function scoreUpcoming(
	profile: TasteProfile,
	records: TmdbMovie[],
	exclude: ReadonlySet<number>
): ScoredFilm[] {
	return records
		.filter((record) => isCandidate(record, exclude))
		.map((record) => {
			const c = components(profile, record);
			return { record, score: combine(c), reason: reasonFor(c) };
		})
		.filter((s) => s.score >= THRESHOLD)
		.sort((a, b) => b.score - a.score)
		.slice(0, MAX_RESULTS);
}
