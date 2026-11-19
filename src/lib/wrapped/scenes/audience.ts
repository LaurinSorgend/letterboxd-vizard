import { TMDB_POPULAR_VOTES } from '$lib/film/votes';
import { languageShare, obscurity } from '$lib/year/facts/audience';
import { widestCriticGap } from '$lib/year/facts/critics';
import { count, percent, plural, stars } from '$lib/format';
import { barsFrom, posterOf, type DeckInput, type Scene } from './shared';

/** A spread over fewer films is a handful of anecdotes. */
const MIN_VOTED = 25;

export function obscurityScene({ library }: DeckInput): Scene | null {
	const spread = obscurity(library);
	if (!spread || spread.voted < MIN_VOTED) return null;
	return {
		id: 'obscurity',
		accent: 'magenta',
		label: 'How obscure, really',
		value: count(spread.median),
		valueKind: 'number',
		note: `Half the films you watched had fewer than ${count(spread.median)} ratings on TMDB. A quarter had fewer than ${count(spread.lowerQuartile)}.`,
		stats: [
			{ label: 'Median votes', value: count(spread.median) },
			{ label: 'Lower quartile', value: count(spread.lowerQuartile) },
			{ label: `Over ${count(TMDB_POPULAR_VOTES)}`, value: count(spread.popular) }
		],
		body: { kind: 'none' }
	};
}

const MIN_LANGUAGED = 15;
/** Under a tenth of the year abroad, the frame would be about a handful of films. */
const MIN_SHARE = 0.1;
const LANGUAGE_BARS = 5;

export function languageScene({ library }: DeckInput): Scene | null {
	const spoken = languageShare(library);
	if (!spoken || spoken.count + spoken.own < MIN_LANGUAGED || spoken.share < MIN_SHARE) return null;
	const largest = spoken.bars[0];
	return {
		id: 'language',
		accent: 'cyan',
		label: `Not in ${spoken.label}`,
		value: percent(spoken.share),
		valueKind: 'number',
		note: `${spoken.count} of ${spoken.count + spoken.own} films were in a language other than ${spoken.label}. ${largest.label} did most of the work, at ${largest.count}.`,
		stats: [
			{ label: 'Languages', value: String(spoken.languages) },
			{ label: `Largest non-${spoken.label}`, value: `${largest.label}, ${largest.count}` },
			{ label: spoken.label, value: String(spoken.own) }
		],
		body: { kind: 'bars', bars: barsFrom(spoken.bars.slice(0, LANGUAGE_BARS)) }
	};
}

/** Below thirty points the two are agreeing, and a frame about agreement is not a frame. */
const MIN_CRITIC_GAP = 30;

export function criticScene({ library }: DeckInput): Scene | null {
	const gap = widestCriticGap(library);
	if (!gap || Math.abs(gap.gap) < MIN_CRITIC_GAP) return null;
	const kinder = gap.gap > 0;
	return {
		id: 'critics',
		accent: 'oxblood',
		label: 'Where the critics went',
		value: gap.film.name,
		valueKind: 'name',
		note: `Critics put it at ${gap.critics} on ${gap.source}. You gave it ${stars(gap.rating)}. That is the widest you and the critics stood apart all year.`,
		stats: [
			{ label: gap.source, value: String(gap.critics) },
			{ label: 'Your rating', value: stars(gap.rating) },
			{
				label: kinder ? 'You were kinder on' : 'You were harsher on',
				value: plural(kinder ? gap.kinder : gap.harsher, 'film')
			}
		],
		body: { kind: 'posters', posters: [posterOf(gap.film, stars(gap.rating))] }
	};
}
