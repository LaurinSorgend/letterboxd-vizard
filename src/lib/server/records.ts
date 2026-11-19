import { DAY_MS } from '$lib/math';
import { isTmdbId, RECORD_SCHEMA, type Collection, type Person, type TmdbMovie } from '$lib/types';
import type { BatchLookup } from './batch';
import type { FetchBudget } from './budget';
import { jsonCache, type Cache } from './cache';
import { tmdbDate, tmdbGet, tmdbYear } from './tmdb';

interface CreditPerson {
	id: number;
	name: string;
	job?: string;
	profile_path?: string | null;
}

interface Details {
	id: number;
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
	production_countries?: { iso_3166_1: string }[];
	origin_country?: string[];
	genres?: { name: string }[];
	runtime?: number | null;
	episode_run_time?: number[];
	number_of_episodes?: number | null;
	last_episode_to_air?: { runtime?: number | null } | null;
	original_language?: string;
	vote_average?: number;
	vote_count?: number;
	poster_path?: string | null;
	created_by?: CreditPerson[];
	credits?: { cast?: CreditPerson[]; crew?: CreditPerson[] };
	belongs_to_collection?: { id: number; name: string; poster_path?: string | null } | null;
	/** Movies put the list under `keywords`, series under `results`. */
	keywords?: { keywords?: { name: string }[]; results?: { name: string }[] };
	external_ids?: { imdb_id?: string | null };
}

/** Enough tags to characterise a film without bloating every cached record. */
const MAX_KEYWORDS = 25;

function toCollection(d: Details): Collection | null {
	const c = d.belongs_to_collection;
	return c ? { id: c.id, name: c.name, posterPath: c.poster_path ?? null } : null;
}

function toKeywords(d: Details): string[] {
	const list = d.keywords?.keywords ?? d.keywords?.results ?? [];
	return list.slice(0, MAX_KEYWORDS).map((k) => k.name.toLowerCase());
}

function toPerson(p: CreditPerson): Person {
	return { name: p.name, tmdbId: p.id, profilePath: p.profile_path ?? null };
}

function dedupe(people: Person[]): Person[] {
	return [...new Map(people.map((p) => [p.name, p])).values()];
}

/**
 * Whole-run length of a series in minutes, or null if TMDB gives nothing to go on.
 * TMDB leaves `episode_run_time` empty or zeroed for many shows, so the last episode's
 * length stands in for a typical one, an estimate that overshoots when a finale runs long.
 */
function seriesRuntime(d: Details): number | null {
	const perEpisode = d.episode_run_time?.find((m) => m > 0) ?? d.last_episode_to_air?.runtime;
	if (!perEpisode || !d.number_of_episodes) return null;
	return perEpisode * d.number_of_episodes;
}

export async function fetchRecord(
	budget: FetchBudget,
	kind: 'movie' | 'tv',
	id: number
): Promise<TmdbMovie> {
	// All three ride along on this one request, so none costs a subrequest against the budget.
	const d = (await tmdbGet(budget, `/${kind}/${id}`, {
		append_to_response: 'credits,keywords,external_ids'
	})) as Details;
	const crewDirectors = d.credits?.crew?.filter((p) => p.job === 'Director') ?? [];
	const directors =
		kind === 'tv' && crewDirectors.length === 0 ? (d.created_by ?? []) : crewDirectors;
	return {
		tmdbId: d.id,
		mediaType: kind,
		title: d.title ?? d.name ?? '',
		year: tmdbYear(d),
		countries: d.production_countries?.map((c) => c.iso_3166_1) ?? [],
		originCountries: d.origin_country ?? [],
		genres: d.genres?.map((g) => g.name) ?? [],
		runtime: kind === 'tv' ? seriesRuntime(d) : (d.runtime ?? null),
		releaseDate: tmdbDate(d),
		originalLanguage: d.original_language ?? null,
		voteAverage: d.vote_average ?? null,
		voteCount: d.vote_count ?? null,
		posterPath: d.poster_path ?? null,
		directors: dedupe(directors.map(toPerson)),
		cast: d.credits?.cast?.slice(0, 10).map(toPerson) ?? [],
		collection: toCollection(d),
		keywords: toKeywords(d),
		imdbId: d.external_ids?.imdb_id || null
	};
}

/** TMDB numbers films and series separately, so a record's key carries its media type. */
export const recordKey = (record: Pick<TmdbMovie, 'mediaType' | 'tmdbId'>): string =>
	`${record.mediaType}:${record.tmdbId}`;

const recordCache = (ttlMs?: number) =>
	jsonCache<string, TmdbMovie>({
		table: 'tmdb_records',
		key: 'record_key',
		version: RECORD_SCHEMA,
		ttlMs
	});

/** Records of every age: a matched film's countries, genres and poster hardly ever change. */
export const records = recordCache();

const movieLookup = (cache: Cache<string, TmdbMovie>): BatchLookup<number, string, TmdbMovie> => ({
	keyOf: (id) => (isTmdbId(id) ? recordKey({ mediaType: 'movie', tmdbId: id }) : null),
	cache,
	fetchOne: (budget, id) => fetchRecord(budget, 'movie', id),
	label: 'tmdb record'
});

/** Full records of TMDB movies by id, from the cache at any age. */
export const movieRecords = movieLookup(records);

/** Credits and dates of unreleased films still change, so /api/records refetches weekly. */
const FRESH_RECORD_MS = 7 * DAY_MS;

/** Full records of TMDB movies by id, refetched once a week old. */
export const freshMovieRecords = movieLookup(recordCache(FRESH_RECORD_MS));
