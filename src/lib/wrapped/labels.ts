import { count, plural } from '$lib/format';

/** Headings the page recap and the deck share, so the two read as one review of one year. */
export const LABELS = {
	title: 'Your year in cinema',
	films: 'Films watched',
	top: 'Your five best',
	genre: 'Genre of the year',
	director: 'Director of the year',
	actor: 'On screen most',
	deepCut: 'Deepest cut',
	biggestCrowd: 'Biggest crowd',
	crowd: 'You against the crowd',
	streak: 'Longest streak',
	verdict: 'Your year in one word'
} as const;

/** The number in "Your five best". */
export const TOP_FILMS = 5;

export const billedIn = (films: number): string => `Billed in ${count(films)} of your films.`;

/** A vote count as both surfaces quote it. */
export const ratingsAcross = (votes: number): string =>
	`${plural(votes, 'rating')} across TMDB and IMDb`;
