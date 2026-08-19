import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from '../wrapped';
import { bestWeekScene, doubleBillScene, gapSilenceScene, weekdayScene } from './timing';

const spread = (dates: string[]) =>
	dates.map((date) => film({ ...watched([date]), tmdb: tmdb({ runtime: 100 }) }));

/** Ten entries in January and one in August: a long silence and a heavy first week. */
const januaryThenAugust = spread([
	'2025-01-01',
	'2025-01-02',
	'2025-01-03',
	'2025-01-04',
	'2025-01-05',
	'2025-01-06',
	'2025-01-07',
	'2025-01-08',
	'2025-01-09',
	'2025-08-20'
]);
const data = () =>
	buildWrapped(januaryThenAugust, 2025, { now: new Date('2026-01-05T00:00:00Z') })!;

describe('gapSilenceScene', () => {
	it('reports the longest silence with both ends of it', () => {
		const scene = gapSilenceScene(data());
		expect(scene).toMatchObject({ id: 'silence', value: '223', valueKind: 'number' });
		expect(scene?.note).toContain('9 January');
		expect(scene?.note).toContain('20 August');
	});

	it('drops out when the year never went quiet', () => {
		const dense = spread(
			Array.from({ length: 30 }, (_, i) => `2025-01-${String(i + 1).padStart(2, '0')}`)
		);
		// Pin `now` inside the fixture's own active window: with the real clock past 2025 the
		// closing date would fall back to 2025-12-31 and the eleven months of silence after
		// January would register as a genuine ~335-day early-stop gap, not "never went quiet".
		const wrapped = buildWrapped(dense, 2025, { now: new Date('2025-02-01T00:00:00Z') })!;
		expect(gapSilenceScene(wrapped)).toBeNull();
	});

	it('reports a late start when that is the largest gap', () => {
		// Ten consecutive daily entries from 1 June: the 151-day run-up from New Year's Day
		// dwarfs both the 1-day between-gaps and the 1-day early-stop to `now`.
		const lateStart = spread(
			Array.from({ length: 10 }, (_, i) => `2025-06-${String(i + 1).padStart(2, '0')}`)
		);
		const wrapped = buildWrapped(lateStart, 2025, { now: new Date('2025-06-11T00:00:00Z') })!;
		expect(gapSilenceScene(wrapped)?.note).toBe(
			'You did not start until 1 June. 151 days of 2025 went by first.'
		);
	});

	it('reports an early stop when that is the largest gap', () => {
		// Ten consecutive daily entries from 1 January: the 355-day silence to the end of the
		// year dwarfs both the 0-day late-start and the 1-day between-gaps.
		const earlyStop = spread(
			Array.from({ length: 10 }, (_, i) => `2025-01-${String(i + 1).padStart(2, '0')}`)
		);
		const wrapped = buildWrapped(earlyStop, 2025, { now: new Date('2025-12-31T00:00:00Z') })!;
		expect(gapSilenceScene(wrapped)?.note).toBe(
			'Your last entry was 10 January, and nothing followed it. 355 days.'
		);
	});
});

describe('weekdayScene', () => {
	it('names the busiest weekday and draws seven bars', () => {
		const many = spread(
			Array.from({ length: 35 }, (_, i) => `2025-0${Math.floor(i / 9) + 1}-0${(i % 9) + 1}`)
		);
		const scene = weekdayScene(buildWrapped(many, 2025)!);
		expect(scene?.id).toBe('weekday');
		expect(scene?.valueKind).toBe('name');
		expect(scene?.body).toMatchObject({ kind: 'bars' });
		expect(scene?.body.kind === 'bars' && scene.body.bars).toHaveLength(7);
	});

	it('drops out under thirty diary entries', () => {
		expect(weekdayScene(data())).toBeNull();
	});
});

describe('bestWeekScene', () => {
	it('reports the heaviest seven days with its posters', () => {
		const scene = bestWeekScene(data());
		expect(scene).toMatchObject({ id: 'week', value: '7' });
		expect(scene?.body.kind).toBe('posters');
	});

	it('drops out when no week reaches five films', () => {
		// Ten entries, each ten days apart: every 7-day window catches exactly one of them, so
		// the best week's count (1) sits well under MIN_WEEK_FILMS (5).
		const sparse = spread([
			'2025-01-01',
			'2025-01-11',
			'2025-01-21',
			'2025-01-31',
			'2025-02-10',
			'2025-02-20',
			'2025-03-02',
			'2025-03-12',
			'2025-03-22',
			'2025-04-01'
		]);
		const wrapped = buildWrapped(sparse, 2025, { now: new Date('2025-04-02T00:00:00Z') })!;
		expect(bestWeekScene(wrapped)).toBeNull();
	});
});

describe('doubleBillScene', () => {
	it('counts the days that carried more than one film', () => {
		const doubles = spread([
			'2025-02-01',
			'2025-02-01',
			'2025-03-01',
			'2025-03-01',
			'2025-03-01',
			'2025-04-01',
			'2025-04-01',
			'2025-05-01',
			'2025-06-01',
			'2025-07-01'
		]);
		const scene = doubleBillScene(buildWrapped(doubles, 2025)!);
		expect(scene).toMatchObject({ id: 'doubles', value: '3' });
		expect(scene?.stats.map((stat) => stat.label)).toContain('Heaviest');
	});

	it('drops out under three such days', () => {
		expect(doubleBillScene(data())).toBeNull();
	});

	it('reads correctly with more than one triple day', () => {
		const doubles = spread([
			'2025-02-01',
			'2025-02-01',
			'2025-02-01',
			'2025-03-01',
			'2025-03-01',
			'2025-03-01',
			'2025-04-01',
			'2025-04-01',
			'2025-05-01',
			'2025-06-01'
		]);
		const scene = doubleBillScene(buildWrapped(doubles, 2025)!);
		expect(scene?.note).toBe(
			'3 days with more than one film. On 2 of them you watched three or more.'
		);
	});
});
