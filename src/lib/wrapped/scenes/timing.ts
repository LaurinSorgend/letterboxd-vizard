import { bestWeek, doubleBills, longestGap, TRIPLE_BILL, weekdays } from '$lib/year/facts/timing';
import { datePair, longDate, weekdayName } from './prose';
import { numberWord, percent, plural } from '$lib/format';
import { posterRow, type DeckInput, type Scene } from './shared';

/** Under a fortnight is a busy life, not a gap. */
const MIN_GAP_DAYS = 14;
const MIN_WEEKDAY_ENTRIES = 30;
const MIN_WEEK_FILMS = 5;
const MIN_DOUBLE_DAYS = 3;

export function gapSilenceScene({ library }: DeckInput): Scene | null {
	const gap = longestGap(library);
	if (!gap || gap.days < MIN_GAP_DAYS) return null;
	const [from, to] = datePair(gap.from, gap.to, library.year);
	const note =
		gap.kind === 'late-start'
			? `You did not start until ${to}. ${plural(gap.days, 'day')} of ${library.year} went by first.`
			: gap.kind === 'early-stop'
				? `Your last entry was ${from}, and nothing followed it. ${plural(gap.days, 'day')}.`
				: `You logged nothing between ${from} and ${to}. ${plural(gap.days, 'day')}, your longest stretch of the year.`;
	return {
		id: 'silence',
		accent: 'indigo',
		label: 'The longest gap',
		value: String(gap.days),
		valueKind: 'number',
		note,
		stats: [
			{ label: 'From', value: from },
			{ label: 'To', value: to },
			{ label: 'Second longest', value: `${gap.second} days` }
		],
		body: { kind: 'none' }
	};
}

export function weekdayScene({ library }: DeckInput): Scene | null {
	const week = weekdays(library);
	if (!week || week.entries < MIN_WEEKDAY_ENTRIES) return null;
	const peak = week.counts[week.best];
	return {
		id: 'weekday',
		accent: 'cyan',
		label: 'Your day of the week',
		value: weekdayName(week.best),
		valueKind: 'name',
		note: `${plural(peak, 'entry', 'entries')} on ${weekdayName(week.best)}s, ${week.counts[week.worst]} on ${weekdayName(week.worst)}s. The week is not flat.`,
		stats: [
			{ label: 'Quietest', value: `${weekdayName(week.worst)}, ${week.counts[week.worst]}` },
			{ label: 'Weekend share', value: percent(week.weekendShare) }
		],
		body: {
			kind: 'bars',
			bars: week.counts.map((count, day) => ({
				label: weekdayName(day).slice(0, 3),
				value: String(count),
				share: count / peak
			}))
		}
	};
}

export function bestWeekScene({ library }: DeckInput): Scene | null {
	const week = bestWeek(library);
	if (!week || week.count < MIN_WEEK_FILMS) return null;
	// A seven-day window opened in late December closes in January, so both ends want the year.
	const [start, end] = datePair(week.start, week.end, library.year);
	return {
		id: 'week',
		accent: 'amber',
		label: 'The heaviest week',
		value: String(week.count),
		valueKind: 'number',
		note: `${plural(week.count, 'film')} between ${start} and ${end}.`,
		stats: [
			{ label: 'From', value: start },
			{ label: 'Best other week', value: String(week.runnerUp) }
		],
		body: {
			kind: 'posters',
			posters: posterRow(week.films, () => '')
		}
	};
}

export function doubleBillScene({ library }: DeckInput): Scene | null {
	const bills = doubleBills(library);
	if (!bills || bills.days < MIN_DOUBLE_DAYS) return null;
	const stats = [
		{ label: 'Triples or more', value: String(bills.triples) },
		{ label: 'Share of entries', value: percent(bills.share) }
	];
	if (bills.heaviest) {
		stats.push({ label: 'Heaviest', value: longDate(bills.heaviest.date, library.year) });
	}
	return {
		id: 'doubles',
		accent: 'gold',
		label: 'Two in a night',
		value: String(bills.days),
		valueKind: 'number',
		note: `${plural(bills.days, 'day')} with more than one film.${bills.triples > 0 ? ` On ${bills.triples} of them you watched ${numberWord(TRIPLE_BILL)} or more.` : ''}`,
		stats,
		body: { kind: 'none' }
	};
}
