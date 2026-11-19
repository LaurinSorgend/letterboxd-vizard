import { count } from '$lib/format';
import { BARS } from './bars';
import type { Rule } from './rules';

/** A face has to recur beyond coincidence: seven films, or a tenth of a heavy year. */
function followed(films: number, appearances: number): boolean {
	return appearances >= Math.max(7, films / 10);
}

export const completist: Rule = {
	title: 'The Completist',
	when: (t) => (t.topDirector?.count ?? 0) >= 6,
	detail: (t) => `You watched ${t.topDirector?.count} films by ${t.topDirector?.name}.`
};

export const returner: Rule = {
	title: 'The Returner',
	when: (t) => t.rewatchShare >= BARS.returner && t.entries >= 20,
	detail: (t) =>
		`${Math.round(t.rewatchShare * t.entries)} of your ${t.entries} entries were films you had already seen.`
};

export const loyalist: Rule = {
	title: 'The Loyalist',
	when: (t) => (t.topCollection?.count ?? 0) >= 5,
	detail: (t) =>
		`You watched ${t.topCollection?.count} films from the ${t.topCollection?.name} collection.`
};

export const follower: Rule = {
	title: 'The Follower',
	when: (t) => followed(t.films, t.topCastMember?.count ?? 0),
	detail: (t) => `${t.topCastMember?.name} appeared in ${t.topCastMember?.count} of your films.`
};

export const diarist: Rule = {
	title: 'The Diarist',
	when: (t) => t.reviewShare >= BARS.diarist && t.films >= 20,
	detail: (t) =>
		`You wrote reviews on ${Math.round(t.reviewShare * t.films)} of ${t.films} films, ${count(t.reviewWords)} words in all.`
};

export const cataloguer: Rule = {
	title: 'The Cataloguer',
	when: (t) => t.tagShare >= 0.5 && t.distinctTags >= 3 && t.films >= 20,
	detail: (t) =>
		`You tagged ${Math.round(t.tagShare * t.films)} of ${t.films} films across ${t.distinctTags} tags.`
};

export const optimist: Rule = {
	title: 'The Optimist',
	when: (t) => t.watchlistRatio >= 5 && t.watchlistSize >= 100,
	detail: (t) =>
		t.watchlistAddedThisYear > t.films
			? `${t.watchlistSize} films on the watchlist, ${t.watchlistAddedThisYear} added this year against ${t.films} watched. The list is growing faster than you are.`
			: `${t.watchlistSize} films on the watchlist against ${t.films} watched this year.`
};
