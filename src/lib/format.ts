/** A counted figure. Years and ratings are not counts and must not be grouped this way. */
export const count = (n: number): string => n.toLocaleString('en');

/** The word for `n` of something: "film" for one, "films" otherwise. */
export const noun = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);

/** A counted figure with its word: "1 film", "1,204 films". */
export const plural = (n: number, one: string, many = `${one}s`): string =>
	`${count(n)} ${noun(n, one, many)}`;

const NUMBER_WORDS = [
	'no',
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'eleven',
	'twelve',
	'thirteen',
	'fourteen',
	'fifteen',
	'sixteen',
	'seventeen',
	'eighteen',
	'nineteen',
	'twenty'
];

/** A fixed number, such as a threshold, as a word in a sentence; a numeral past twenty. */
export const numberWord = (n: number): string => NUMBER_WORDS[n] ?? count(n);

/** Counts below this read as words inside a sentence; larger ones stay numerals. */
export const SPELLED_BELOW = 10;

/** A count inside a sentence: "three films", but "12 films". */
export const spell = (n: number): string => (n < SPELLED_BELOW ? numberWord(n) : count(n));

/** A 0–1 share as a whole percentage. */
export const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** A figure to `digits` places, e.g. an average rating in a table; a dash when there is none. */
export const fixed = (value: number | null, digits: number): string =>
	value === null ? '—' : value.toFixed(digits);

/** A star rating or average, e.g. "★ 3.8"; a dash when there is none. */
export const stars = (rating: number | null, digits = 1): string =>
	rating === null ? '—' : `★ ${fixed(rating, digits)}`;

/** A single rating as a caption, the way Letterboxd prints it: "★ 4", "★ 3.5"; empty when unrated. */
export function starCaption(rating: number | null): string {
	return rating === null ? '' : `★ ${rating}`;
}

/*
 * Diary dates are calendar days with no time zone of their own, so the date formats below read
 * and print them as UTC.
 */

/** "Mar 5, 2026". */
export function formatShort(iso: string): string {
	return new Date(iso).toLocaleDateString('en', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** "5 Mar", for dates whose year is already given. */
export function formatDayMonth(iso: string): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
}

/** A day count as a rough span: "12 days", "5 months", "3.2 years". */
export function formatDays(days: number): string {
	if (days < 60) return `${Math.round(days)} days`;
	if (days < 365) return `${Math.round(days / 30)} months`;
	return `${(days / 365).toFixed(1)} years`;
}

/** Compact minutes or hours for tight spots like legend ends: `45m`, `2h`, `2.5h`. */
export function minuteLabel(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	return minutes % 60 === 0 ? `${minutes / 60}h` : `${(minutes / 60).toFixed(1)}h`;
}

/** Total watched runtime: `45 min`, `2h`, `2h 5m`; "runtime unknown" when the sum is zero. */
export function formatWatchtime(minutes: number): string {
	if (minutes <= 0) return 'runtime unknown';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** One film's length as a showcase figure or a poster caption: `95m`, `2h 0m`. */
export function runtimeLabel(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	return hours === 0 ? `${minutes}m` : `${hours}h ${minutes % 60}m`;
}

/** One film's length as an axis tick: `95m`, `2h`, `2h15`. */
export function formatRuntime(minutes: number): string {
	return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 || ''}` : `${minutes}m`;
}

export function formatHours(hours: number): string {
	return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

/** "12k" style label; TMDB vote counts never reach a range where "M" would be needed. */
export function formatPopularity(count: number): string {
	return count >= 1000 ? `${count / 1000}k` : String(count);
}

/** TMDB names every franchise "<name> Collection"; the suffix reads as noise in a list or a sentence. */
export const collectionName = (raw: string): string => raw.replace(/ Collection$/, '');
