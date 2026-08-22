import { languageShare, obscurity } from '../facts/audience';
import { widestCriticGap } from '../facts/critics';
import { barsFrom, count, plural, posterOf, stars, type Scene } from './shared';
import type { Wrapped } from '../wrapped';

export function obscurityScene(data: Wrapped): Scene | null {
	const spread = obscurity(data.library);
	if (!spread) return null;
	return {
		id: 'obscurity',
		accent: 'magenta',
		label: 'How obscure, really',
		value: spread.median.toLocaleString('en'),
		valueKind: 'number',
		note: `Half the films you watched had fewer than ${spread.median.toLocaleString('en')} ratings on TMDB. A quarter had fewer than ${spread.lowerQuartile.toLocaleString('en')}.`,
		stats: [
			{ label: 'Median votes', value: spread.median.toLocaleString('en') },
			{ label: 'Lower quartile', value: spread.lowerQuartile.toLocaleString('en') },
			{ label: 'Over 10,000', value: count(spread.overTenThousand) }
		],
		body: { kind: 'none' }
	};
}

export function languageScene(data: Wrapped): Scene | null {
	const spoken = languageShare(data.library);
	if (!spoken) return null;
	return {
		id: 'language',
		accent: 'cyan',
		label: `Not in ${spoken.label}`,
		value: `${Math.round(spoken.share * 100)}%`,
		valueKind: 'number',
		note: `${spoken.count} of ${spoken.count + spoken.own} films were in a language other than ${spoken.label}.${spoken.largest ? ` ${spoken.largest.label} did most of the work, at ${spoken.largest.count}.` : ''}`,
		stats: [
			{ label: 'Languages', value: String(spoken.languages) },
			{
				label: spoken.largest ? `Largest non-${spoken.label}` : 'Other',
				value: spoken.largest ? `${spoken.largest.label}, ${spoken.largest.count}` : '0'
			},
			{ label: spoken.label, value: String(spoken.own) }
		],
		body: { kind: 'bars', bars: barsFrom(spoken.shownBars) }
	};
}

export function criticScene(data: Wrapped): Scene | null {
	const gap = widestCriticGap(data.library);
	if (!gap) return null;
	const kinder = gap.gap > 0;
	return {
		id: 'critics',
		accent: 'oxblood',
		label: 'Where the critics went',
		value: gap.film.name,
		valueKind: 'name',
		note: `Critics put it at ${gap.critics} on ${gap.source}. You gave it ${stars(gap.yours / 20)}. That is the widest you and the critics stood apart all year.`,
		stats: [
			{ label: gap.source, value: String(gap.critics) },
			{ label: 'Your rating', value: stars(gap.yours / 20) },
			{
				label: kinder ? 'You were kinder on' : 'You were harsher on',
				value: plural(kinder ? gap.kinder : gap.harsher, 'film')
			}
		],
		body: { kind: 'posters', posters: [posterOf(gap.film, stars(gap.yours / 20))] }
	};
}
