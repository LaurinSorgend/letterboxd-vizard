import { effectiveCountries } from '../countries';
import { avgRating, byGenre, byPerson, combinedVoteCount, grouped } from '../stats';
import { doubleBills, longestGap, weekdays } from '$lib/wrapped/facts/timing';
import { filmsPerYear } from '$lib/wrapped/facts/history';
import { monthOf } from '$lib/wrapped/facts/dates';
import { datesIn, viewerLanguage, type Library } from '$lib/wrapped/library';
import type { EnrichedFilm } from '$lib/types';

export interface Traits {
	year: number;
	films: number;
	entries: number;
	activeMonths: number;
	monthCounts: number[];
	decemberShare: number;
	firstQuarterShare: number;
	lastThirdShare: number;
	sprintShare: number;
	weekendShare: number;
	longestGapDays: number;
	previousYearFilms: number;
	/** Counts for this year and the two before it, newest first. */
	recentYears: number[];
	loggedBeforePreviousYear: boolean;
	rated: number;
	ratedShare: number;
	meanRating: number | null;
	fiveStarShare: number;
	/** The largest share sitting inside one adjacent pair of half-star steps. */
	pairShare: number;
	likedCount: number;
	likedShare: number;
	crowdCount: number;
	crowdMeanAbs: number | null;
	crowdMeanSigned: number | null;
	metascoreCount: number;
	metascoreMean: number | null;
	medianVotes: number | null;
	lowVoteShare: number;
	highVoteShare: number;
	obscureShare: number | null;
	medianYear: number | null;
	releasedThisYearShare: number;
	preEightiesShare: number;
	topDecade: number | null;
	topDecadeShare: number;
	foreignShare: number;
	topCountry: string | null;
	topCountryShare: number;
	topGenre: string | null;
	topGenreShare: number;
	meanRuntime: number | null;
	runtimeCount: number;
	televisionShare: number;
	countries: number;
	rewatchShare: number;
	topCollection: { name: string; count: number } | null;
	topDirector: { name: string; count: number } | null;
	topCastMember: { name: string; count: number } | null;
	reviewShare: number;
	reviewWords: number;
	tagShare: number;
	distinctTags: number;
	watchlistSize: number;
	watchlistRatio: number;
	watchlistAddedThisYear: number;
}

const share = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);
const mean = (values: number[]): number | null =>
	values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]): number | null =>
	values.length === 0 ? null : [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const releaseYear = (film: EnrichedFilm): number | null => film.tmdb?.year ?? film.year;

function rhythmTraits(library: Library) {
	const { slice, dates, year } = library;
	const monthCounts = Array.from({ length: 12 }, () => 0);
	for (const date of dates) monthCounts[monthOf(date)] += 1;
	const perYear = filmsPerYear(library);
	const countFor = (y: number) => perYear.find((entry) => entry.year === y)?.count ?? 0;
	return {
		year,
		films: slice.length,
		entries: dates.length,
		activeMonths: monthCounts.filter((count) => count > 0).length,
		monthCounts,
		decemberShare: share(monthCounts[11], dates.length),
		firstQuarterShare: share(
			monthCounts.slice(0, 3).reduce((a, b) => a + b, 0),
			dates.length
		),
		lastThirdShare: share(
			monthCounts.slice(8).reduce((a, b) => a + b, 0),
			dates.length
		),
		sprintShare: doubleBills(library)?.share ?? 0,
		weekendShare: weekdays(library)?.weekendShare ?? 0,
		longestGapDays: longestGap(library)?.days ?? 0,
		previousYearFilms: countFor(year - 1),
		recentYears: [countFor(year), countFor(year - 1), countFor(year - 2)],
		loggedBeforePreviousYear: perYear.some((entry) => entry.year < year - 1 && entry.count > 0)
	};
}

function ratingTraits(library: Library) {
	const { slice } = library;
	const ratings = slice.map((film) => film.rating).filter((r): r is number => r !== null);
	const steps = new Map<number, number>();
	for (const rating of ratings) steps.set(rating, (steps.get(rating) ?? 0) + 1);
	const pairs = [...steps.keys()].map(
		(step) => ((steps.get(step) ?? 0) + (steps.get(step + 0.5) ?? 0)) / Math.max(1, ratings.length)
	);
	const crowd = slice
		.filter((film) => film.rating !== null && film.tmdb?.voteAverage)
		.map((film) => (film.rating as number) - (film.tmdb?.voteAverage as number) / 2);
	const metascores = slice
		.map((film) => film.omdb?.metascore)
		.filter((score): score is number => typeof score === 'number');
	return {
		rated: ratings.length,
		ratedShare: share(ratings.length, slice.length),
		meanRating: avgRating(slice),
		fiveStarShare: share(ratings.filter((rating) => rating === 5).length, ratings.length),
		pairShare: pairs.length === 0 ? 0 : Math.max(...pairs),
		likedCount: slice.filter((film) => film.liked).length,
		likedShare: share(slice.filter((film) => film.liked).length, slice.length),
		crowdCount: crowd.length,
		crowdMeanAbs: mean(crowd.map(Math.abs)),
		crowdMeanSigned: mean(crowd),
		metascoreCount: metascores.length,
		metascoreMean: mean(metascores)
	};
}

function tasteTraits(library: Library) {
	const { slice, year } = library;
	const votes = slice.map((film) => film.tmdb?.voteCount).filter((v): v is number => !!v);
	const years = slice.map(releaseYear).filter((y): y is number => y !== null);
	const decades = grouped(slice, (film) => {
		const released = releaseYear(film);
		return released === null ? [] : [String(Math.floor(released / 10) * 10)];
	});
	const genres = byGenre(slice);
	const countries = grouped(slice, (film) => (film.tmdb ? effectiveCountries(film.tmdb) : []));
	const language = viewerLanguage(library);
	const spoken = slice.filter((film) => film.tmdb?.originalLanguage);
	const runtimes = slice.map((film) => film.tmdb?.runtime).filter((r): r is number => !!r);
	return {
		medianVotes: median(votes),
		lowVoteShare: share(votes.filter((count) => count < 1_000).length, votes.length),
		highVoteShare: share(votes.filter((count) => count > 10_000).length, votes.length),
		obscureShare: (() => {
			const combined = slice.map(combinedVoteCount).filter((count) => count > 0);
			return combined.length === 0
				? null
				: share(combined.filter((count) => count < 1_000).length, combined.length);
		})(),
		medianYear: median(years),
		releasedThisYearShare: share(years.filter((y) => y === year).length, years.length),
		preEightiesShare: share(years.filter((y) => y < 1980).length, years.length),
		topDecade: decades[0] ? Number.parseInt(decades[0].label, 10) : null,
		topDecadeShare: share(decades[0]?.count ?? 0, slice.length),
		foreignShare: share(
			spoken.filter((film) => film.tmdb?.originalLanguage !== language).length,
			spoken.length
		),
		topCountry: countries[0]?.label ?? null,
		topCountryShare: share(countries[0]?.count ?? 0, slice.length),
		topGenre: genres[0]?.label ?? null,
		topGenreShare: share(genres[0]?.count ?? 0, slice.length),
		meanRuntime: mean(runtimes),
		runtimeCount: runtimes.length,
		televisionShare: share(
			slice.filter((film) => film.tmdb?.mediaType === 'tv').length,
			slice.length
		),
		countries: new Set(slice.flatMap((f) => (f.tmdb ? effectiveCountries(f.tmdb) : []))).size
	};
}

function habitTraits(library: Library) {
	const { slice, dates, year, watchlist } = library;
	const collections = grouped(slice, (film) =>
		film.tmdb?.collection ? [film.tmdb.collection.name.replace(/ Collection$/, '')] : []
	);
	const directors = byPerson(slice, 'directors');
	const cast = byPerson(slice, 'cast');
	const reviewed = slice.filter((film) => film.review);
	const tagged = slice.filter((film) => film.tags.length > 0);
	const rewatched = slice.reduce(
		(sum, film) => sum + Math.max(0, datesIn(film, year).length - (film.rewatch ? 0 : 1)),
		0
	);
	return {
		rewatchShare: share(rewatched, dates.length),
		topCollection: collections[0]
			? { name: collections[0].label, count: collections[0].count }
			: null,
		topDirector: directors[0] ? { name: directors[0].label, count: directors[0].count } : null,
		topCastMember: cast[0] ? { name: cast[0].label, count: cast[0].count } : null,
		reviewShare: share(reviewed.length, slice.length),
		reviewWords: reviewed.reduce(
			(sum, film) => sum + (film.review ?? '').trim().split(/\s+/).filter(Boolean).length,
			0
		),
		tagShare: share(tagged.length, slice.length),
		distinctTags: new Set(slice.flatMap((film) => film.tags)).size,
		watchlistSize: watchlist.length,
		watchlistRatio: share(watchlist.length, slice.length),
		watchlistAddedThisYear: watchlist.filter((entry) => entry.added?.startsWith(`${year}-`)).length
	};
}

export function buildTraits(library: Library): Traits {
	return {
		...rhythmTraits(library),
		...ratingTraits(library),
		...tasteTraits(library),
		...habitTraits(library)
	};
}
