import { isSeries, sittingMinutes } from '$lib/film/runtime';
import { median } from '$lib/math';
import { METACRITIC, starGapsTo, TMDB } from '$lib/film/ratings';
import { grouped, obscurityShare } from '$lib/film/tally';
import { type Library } from '../library';
import { releaseYear } from '$lib/film/release';
import { TMDB_OBSCURE_VOTES, TMDB_POPULAR_VOTES } from '$lib/film/votes';
import { languageShare, tmdbVotes } from '../facts/audience';
import { medianReleaseYear } from '../facts/extremes';
import { filmsPerYear } from '../facts/history';
import { biggestCollection, topTag, watchlistMaths, writing } from '../facts/library-facts';
import { perMonth } from '../facts/months';
import { freshness } from '../facts/release';
import { doubleBills, longestGap, weekdays } from '../facts/timing';
import { averageRating, countries, rewatches } from '../facts/totals';
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
	/** On TMDB's own vote count, like the two shares after it and their TMDB_* bands. */
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
const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

function rhythmTraits(library: Library) {
	const { slice, dates, year } = library;
	const monthCounts = perMonth(library);
	const perYear = filmsPerYear(library);
	const countFor = (y: number) => perYear.find((entry) => entry.year === y)?.count ?? 0;
	return {
		year,
		films: slice.length,
		entries: dates.length,
		activeMonths: monthCounts.filter((count) => count > 0).length,
		monthCounts,
		decemberShare: share(monthCounts[11], dates.length),
		firstQuarterShare: share(sum(monthCounts.slice(0, 3)), dates.length),
		lastThirdShare: share(sum(monthCounts.slice(8)), dates.length),
		sprintShare: doubleBills(library)?.tripleShare ?? 0,
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
	const crowd = starGapsTo(slice, TMDB).map((g) => g.gap);
	const metascores = slice.map(METACRITIC.of).filter((score) => score !== null);
	const liked = slice.filter((film) => film.liked).length;
	return {
		rated: ratings.length,
		ratedShare: share(ratings.length, slice.length),
		meanRating: averageRating(library),
		fiveStarShare: share(ratings.filter((rating) => rating === 5).length, ratings.length),
		pairShare: pairs.length === 0 ? 0 : Math.max(...pairs),
		likedCount: liked,
		likedShare: share(liked, slice.length),
		crowdCount: crowd.length,
		crowdMeanAbs: mean(crowd.map(Math.abs)),
		crowdMeanSigned: mean(crowd),
		metascoreCount: metascores.length,
		metascoreMean: mean(metascores)
	};
}

function tasteTraits(library: Library) {
	const { slice } = library;
	const votes = tmdbVotes(library);
	const years = slice.map(releaseYear).filter((y): y is number => y !== null);
	const decades = grouped(slice, (film) => {
		const released = releaseYear(film);
		return released === null ? [] : [String(Math.floor(released / 10) * 10)];
	});
	const genres = library.genres();
	const places = countries(library);
	const runtimes = slice.map(sittingMinutes).filter((r): r is number => r !== null);
	return {
		medianVotes: median(votes),
		lowVoteShare: share(votes.filter((count) => count < TMDB_OBSCURE_VOTES).length, votes.length),
		highVoteShare: share(votes.filter((count) => count > TMDB_POPULAR_VOTES).length, votes.length),
		obscureShare: obscurityShare(slice),
		medianYear: medianReleaseYear(library),
		releasedThisYearShare: freshness(library).share,
		preEightiesShare: share(years.filter((y) => y < 1980).length, years.length),
		topDecade: decades[0] ? Number.parseInt(decades[0].label, 10) : null,
		topDecadeShare: share(decades[0]?.count ?? 0, slice.length),
		foreignShare: languageShare(library)?.share ?? 0,
		topCountry: places[0]?.code ?? null,
		topCountryShare: share(places[0]?.count ?? 0, slice.length),
		topGenre: genres[0]?.label ?? null,
		topGenreShare: share(genres[0]?.count ?? 0, slice.length),
		meanRuntime: mean(runtimes),
		runtimeCount: runtimes.length,
		televisionShare: share(slice.filter(isSeries).length, slice.length),
		countries: places.length
	};
}

function habitTraits(library: Library) {
	const { slice, dates } = library;
	const collection = biggestCollection(library);
	const directors = library.directors();
	const cast = library.cast();
	const written = writing(library);
	const tag = topTag(library);
	const watchlist = watchlistMaths(library);
	return {
		rewatchShare: share(rewatches(library), dates.length),
		topCollection: collection ? { name: collection.name, count: collection.seen } : null,
		topDirector: directors[0] ? { name: directors[0].label, count: directors[0].count } : null,
		topCastMember: cast[0] ? { name: cast[0].label, count: cast[0].count } : null,
		reviewShare: share(written?.reviews ?? 0, slice.length),
		reviewWords: written?.words ?? 0,
		tagShare: share(tag?.tagged ?? 0, slice.length),
		distinctTags: tag?.distinct ?? 0,
		watchlistSize: watchlist.size,
		watchlistRatio: share(watchlist.size, slice.length),
		watchlistAddedThisYear: watchlist.addedThisYear
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
