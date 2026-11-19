import { count, percent } from '$lib/format';
import { countryName } from '$lib/film/countries';
import { OBSCURE_VOTES, TMDB_OBSCURE_VOTES, TMDB_POPULAR_VOTES } from '$lib/film/votes';
import { BARS, residencyBar } from './bars';
import type { Rule } from './rules';

function residency(country: string | null, share: number): boolean {
	return country === null ? false : share >= residencyBar(country);
}

export const deepDiver: Rule = {
	title: 'The Deep Diver',
	when: (t) => (t.obscureShare ?? 0) >= BARS.deepDiver,
	detail: (t) =>
		`${percent(t.obscureShare ?? 0)} of what you watched has under ${count(OBSCURE_VOTES)} ratings across TMDB and IMDb.`
};

export const timeTraveller: Rule = {
	title: 'The Time Traveller',
	when: (t) => t.medianYear !== null && t.year - t.medianYear >= 25,
	detail: (t) => `Your median film came out in ${t.medianYear}.`
};

export const globetrotter: Rule = {
	title: 'The Globetrotter',
	when: (t) => t.countries >= BARS.globetrotter,
	detail: (t) => `You watched films from ${t.countries} countries.`
};

export const marathoner: Rule = {
	title: 'The Marathoner',
	when: (t) => (t.meanRuntime ?? 0) >= BARS.marathoner,
	detail: (t) => `Your average film ran ${Math.round(t.meanRuntime ?? 0)} minutes.`
};

export const populist: Rule = {
	title: 'The Populist',
	when: (t) => (t.medianVotes ?? 0) >= 15_000 && t.films >= 20,
	detail: (t) => `The median film in your year had ${count(t.medianVotes ?? 0)} TMDB ratings.`
};

export const omnivore: Rule = {
	title: 'The Omnivore',
	when: (t) => t.lowVoteShare >= 0.15 && t.highVoteShare >= 0.15 && t.films >= 25,
	detail: (t) =>
		`${percent(t.lowVoteShare)} of the films TMDB has counted sat under ${count(TMDB_OBSCURE_VOTES)} votes, and ${percent(t.highVoteShare)} sat over ${count(TMDB_POPULAR_VOTES)}.`
};

export const frontrunner: Rule = {
	title: 'The Frontrunner',
	when: (t) => t.releasedThisYearShare >= BARS.frontrunner && t.films >= 20,
	detail: (t) => `${percent(t.releasedThisYearShare)} of what you watched came out in ${t.year}.`
};

export const archivist: Rule = {
	title: 'The Archivist',
	when: (t) => t.preEightiesShare >= 0.9 && t.films >= 15,
	detail: (t) => `${percent(t.preEightiesShare)} of what you watched was made before 1980.`
};

export const settler: Rule = {
	title: 'The Settler',
	when: (t) =>
		t.topDecadeShare >= 0.5 &&
		t.films >= 20 &&
		t.topDecade !== null &&
		t.topDecade !== Math.floor(t.year / 10) * 10,
	detail: (t) =>
		`${Math.round(t.topDecadeShare * t.films)} of ${t.films} films were made in the ${t.topDecade}s.`
};

export const subtitler: Rule = {
	title: 'The Subtitler',
	when: (t) => t.foreignShare >= BARS.subtitler && t.films >= 20,
	detail: (t) => `${percent(t.foreignShare)} of what you watched was not in your own language.`
};

export const resident: Rule = {
	title: 'The Resident',
	when: (t) => residency(t.topCountry, t.topCountryShare) && t.films >= 20,
	detail: (t) =>
		`${percent(t.topCountryShare)} of your year was produced in ${countryName(t.topCountry ?? '')}.`
};

export const specialist: Rule = {
	title: 'The Specialist',
	when: (t) => t.topGenreShare >= BARS.specialist && t.films >= 20,
	detail: (t) =>
		`${Math.round(t.topGenreShare * t.films)} ${t.topGenre?.toLowerCase()} films out of ${t.films}.`
};

export const miniaturist: Rule = {
	title: 'The Miniaturist',
	when: (t) => (t.meanRuntime ?? 999) <= 95 && t.runtimeCount >= 20,
	detail: (t) => `Mean runtime ${Math.round(t.meanRuntime ?? 0)} minutes.`
};

export const serialist: Rule = {
	title: 'The Serialist',
	when: (t) => t.televisionShare >= 0.25 && t.films >= 20,
	detail: (t) =>
		`${Math.round(t.televisionShare * t.films)} of the ${t.films} titles you watched were television.`
};
