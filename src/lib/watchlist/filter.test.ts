import { describe, expect, it } from 'vitest';
import { tmdb } from '$lib/testing/fixtures';
import type { Provider, RegionOffers, TmdbMovie, WatchlistFilm } from '$lib/types';
import {
	filterWatchlist,
	NO_FILTERS,
	serviceCounts,
	sortWatchlist,
	type OffersOf,
	type WatchFilters
} from './filter';

const netflix: Provider = { id: 8, name: 'Netflix', logoPath: null };
const mubi: Provider = { id: 11, name: 'MUBI', logoPath: null };
const apple: Provider = { id: 2, name: 'Apple TV', logoPath: null };

function offers(over: Partial<RegionOffers> = {}): RegionOffers {
	return { link: null, flatrate: [], free: [], ads: [], rent: [], buy: [], ...over };
}

function entry(name: string, record: Partial<TmdbMovie> = {}, added = '2024-01-01'): WatchlistFilm {
	const year = record.year ?? 2020;
	const releaseDate = `${year}-06-01`;
	return {
		uri: `https://boxd.it/${name}`,
		name,
		year,
		added,
		tmdb: tmdb({ releaseDate, ...record })
	};
}

const stalker = entry(
	'Stalker',
	{ year: 1979, genres: ['Drama'], originalLanguage: 'ru', runtime: 161 },
	'2024-03-01'
);
const heat = entry(
	'Heat',
	{ year: 1995, genres: ['Crime'], voteAverage: 7.9, voteCount: 9000 },
	'2024-01-01'
);
const paddington = entry(
	'Paddington',
	{ year: 2014, genres: ['Family'], runtime: 95, voteCount: 4000 },
	'2024-02-01'
);
const all = [stalker, heat, paddington];

const byName: Record<string, RegionOffers | null> = {
	Stalker: offers({ flatrate: [mubi] }),
	Heat: offers({ flatrate: [netflix], rent: [apple] }),
	Paddington: null
};
const offersOf: OffersOf = (film) => byName[film.name];

const names = (films: WatchlistFilm[]) => films.map((f) => f.name);
const run = (over: Partial<WatchFilters>) =>
	names(filterWatchlist(all, { ...NO_FILTERS, ...over }, offersOf));

describe('filterWatchlist', () => {
	it('keeps everything with no filters set', () => {
		expect(run({})).toEqual(['Stalker', 'Heat', 'Paddington']);
	});

	it('keeps films streaming anywhere, or nowhere', () => {
		expect(run({ availability: 'stream' })).toEqual(['Stalker', 'Heat']);
		expect(run({ availability: 'none' })).toEqual(['Paddington']);
		expect(run({ availability: 'rent' })).toEqual(['Heat']);
	});

	it('counts only the picked services', () => {
		expect(run({ services: [netflix.id] })).toEqual(['Heat']);
		expect(run({ availability: 'none', services: [netflix.id] })).toEqual([
			'Stalker',
			'Paddington'
		]);
	});

	it('leaves out films whose offers are still loading once availability matters', () => {
		const loading: OffersOf = () => undefined;
		expect(filterWatchlist(all, { ...NO_FILTERS, availability: 'stream' }, loading)).toEqual([]);
		expect(filterWatchlist(all, NO_FILTERS, loading)).toHaveLength(3);
	});

	it('narrows by facets and year range', () => {
		expect(run({ genre: 'Crime' })).toEqual(['Heat']);
		expect(run({ language: 'ru' })).toEqual(['Stalker']);
		expect(run({ fromYear: 1990, toYear: 2000 })).toEqual(['Heat']);
		expect(run({ maxRuntime: 120 })).toEqual(['Heat', 'Paddington']);
		expect(run({ minRating: 7.5 })).toEqual(['Heat']);
	});

	it('searches titles and people', () => {
		const withDirector = entry('Solaris', {
			directors: [{ name: 'Andrei Tarkovsky', tmdbId: 1, profilePath: null }]
		});
		const films = [...all, withDirector];
		const found = filterWatchlist(films, { ...NO_FILTERS, query: 'tarkov' }, offersOf);
		expect(names(found)).toEqual(['Solaris']);
	});
});

describe('sortWatchlist', () => {
	it('orders by date added and release', () => {
		expect(names(sortWatchlist(all, 'added-desc'))).toEqual(['Stalker', 'Paddington', 'Heat']);
		expect(names(sortWatchlist(all, 'release-asc'))).toEqual(['Stalker', 'Heat', 'Paddington']);
	});

	it('puts films missing the value last either way', () => {
		const unknown: WatchlistFilm = { uri: 'x', name: 'Aaa', year: null, added: null, tmdb: null };
		expect(names(sortWatchlist([unknown, ...all], 'runtime-asc')).at(-1)).toBe('Aaa');
		expect(names(sortWatchlist([unknown, ...all], 'runtime-desc')).at(-1)).toBe('Aaa');
	});

	it('shuffles the same way for the same seed', () => {
		expect(sortWatchlist(all, 'shuffle', 3)).toEqual(sortWatchlist(all, 'shuffle', 3));
	});
});

describe('serviceCounts', () => {
	it('counts streaming services only, busiest first', () => {
		const counts = serviceCounts(all, offersOf);
		expect(counts.map((c) => [c.provider.name, c.films])).toEqual([
			['MUBI', 1],
			['Netflix', 1]
		]);
	});
});
