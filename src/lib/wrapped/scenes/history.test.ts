import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from '../wrapped';
import {
	driftScene,
	firstTimersScene,
	fiveStarScene,
	mostLoggedScene,
	perYearScene
} from './history';

const yearOf = (year: number, count: number, rating: number | null = 4) =>
	Array.from({ length: count }, (_, i) =>
		film({
			...watched([`${year}-0${(i % 9) + 1}-1${i % 9}`], rating),
			rating,
			tmdb: tmdb({ runtime: 100 })
		})
	);

const paddington = film({
	name: 'Paddington 2',
	rating: 4.5,
	watchedDates: ['2019-03-01', '2022-06-01', '2025-02-01'],
	entries: [
		{ date: '2019-03-01', rating: 3, rewatch: false },
		{ date: '2022-06-01', rating: 4, rewatch: true },
		{ date: '2025-02-01', rating: 4.5, rewatch: true }
	]
});

const export2Years = [...yearOf(2024, 12), ...yearOf(2025, 25, 5), paddington];
const data = () => buildWrapped(export2Years, 2025)!;

describe('perYearScene', () => {
	it('sets this year against the years before it', () => {
		const scene = perYearScene(data());
		expect(scene).toMatchObject({ id: 'per-year', value: '26' });
		expect(scene?.body.kind).toBe('bars');
		expect(scene?.note).toContain('2024');
		// Full string: catches a formula that quotes the wrong year or the wrong denominator.
		expect(scene?.note).toBe(
			'26 films in 2025, against 12 in 2024. Your busiest year was 2025, with 26.'
		);
		expect(scene?.stats).toEqual([
			{ label: '2024', value: '12' },
			// (26-12)/12 = +117%; a denominator of 26 (current, not previous) would give +54% instead.
			{ label: 'Change', value: '+117%' },
			{ label: 'Best year', value: '2025' }
		]);
	});

	it('drops out on a single-year export', () => {
		expect(perYearScene(buildWrapped(yearOf(2025, 12), 2025)!)).toBeNull();
	});

	it('shows an em dash when the year before had nothing logged', () => {
		const films = [...yearOf(2023, 5), ...yearOf(2025, 15)];
		const scene = perYearScene(buildWrapped(films, 2025)!);
		expect(scene?.stats.find((s) => s.label === 'Change')?.value).toBe('—');
		expect(scene?.note).toContain('against 0 in 2024');
	});
});

describe('mostLoggedScene', () => {
	it('names the film returned to most often', () => {
		const scene = mostLoggedScene(data());
		expect(scene).toMatchObject({ id: 'most-logged', value: 'Paddington 2', valueKind: 'name' });
		expect(scene?.stats.find((stat) => stat.label === 'Total logs')?.value).toBe('3');
		// Full string, singular "1 of them" and no trailing sentence (no runner-up exists).
		expect(scene?.note).toBe('3 times since March 2019, 1 of them this year.');
	});

	it('drops out when no film has been logged three times or more', () => {
		expect(mostLoggedScene(buildWrapped(yearOf(2025, 12), 2025)!)).toBeNull();
	});

	it('drops out when the most-logged film was not watched this year', () => {
		const oldFavourite = film({
			watchedDates: ['2020-01-01', '2021-01-01', '2022-01-01'],
			entries: [
				{ date: '2020-01-01', rating: 4, rewatch: false },
				{ date: '2021-01-01', rating: 4, rewatch: true },
				{ date: '2022-01-01', rating: 4, rewatch: true }
			]
		});
		const films = [...yearOf(2025, 12), oldFavourite];
		expect(mostLoggedScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('does not pluralise "of them" wrongly when it happened more than once this year', () => {
		const returner = film({
			name: 'Comfort Rewatch',
			watchedDates: ['2023-01-01', '2025-02-01', '2025-08-01'],
			entries: [
				{ date: '2023-01-01', rating: 4, rewatch: false },
				{ date: '2025-02-01', rating: 4, rewatch: true },
				{ date: '2025-08-01', rating: 4, rewatch: true }
			]
		});
		const films = [...yearOf(2025, 10), returner];
		const scene = mostLoggedScene(buildWrapped(films, 2025)!);
		expect(scene?.note).toBe('3 times since January 2023, 2 of them this year.');
	});

	it('names the runner-up count when one exists', () => {
		const winner = film({
			watchedDates: ['2021-01-01', '2022-01-01', '2023-01-01', '2025-03-01'],
			entries: [
				{ date: '2021-01-01', rating: 4, rewatch: false },
				{ date: '2022-01-01', rating: 4, rewatch: true },
				{ date: '2023-01-01', rating: 4, rewatch: true },
				{ date: '2025-03-01', rating: 4, rewatch: true }
			]
		});
		const second = film({
			watchedDates: ['2020-01-01', '2020-06-01', '2020-09-01'],
			entries: [
				{ date: '2020-01-01', rating: 4, rewatch: false },
				{ date: '2020-06-01', rating: 4, rewatch: true },
				{ date: '2020-09-01', rating: 4, rewatch: true }
			]
		});
		const films = [...yearOf(2025, 10), winner, second];
		const scene = mostLoggedScene(buildWrapped(films, 2025)!);
		expect(scene?.note).toBe(
			'4 times since January 2021, 1 of them this year. No other film in your diary has been logged more than 3 times.'
		);
	});
});

describe('fiveStarScene', () => {
	it('counts the top rating and compares it with last year', () => {
		const scene = fiveStarScene(data());
		expect(scene).toMatchObject({ id: 'five-stars', value: '25' });
		expect(scene?.body.kind).toBe('posters');
		// Full string: "gave 0" alone would be meaningless without the noun it counts.
		expect(scene?.note).toBe(
			'25 five-star ratings out of 26 rated films. Last year you gave 0 five-star ratings.'
		);
	});

	it('drops out under twenty rated films', () => {
		expect(
			fiveStarScene(buildWrapped([...yearOf(2024, 12), ...yearOf(2025, 12)], 2025)!)
		).toBeNull();
	});

	it('drops out when nothing was rated five stars, even with twenty rated films', () => {
		const films = yearOf(2025, 20, 4);
		expect(fiveStarScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('shares against the rated total, not the whole watched slice, and omits last year when it never happened', () => {
		// 20 five-star films plus 5 unrated films: share must be 100%, not 20/25 = 80%.
		const fiveStarFilms = yearOf(2025, 20, 5);
		const unrated = yearOf(2025, 5, null);
		const scene = fiveStarScene(buildWrapped([...fiveStarFilms, ...unrated], 2025)!);
		expect(scene?.stats.find((s) => s.label === 'Share')?.value).toBe('100%');
		expect(scene?.stats.some((s) => s.label === 'In 2024')).toBe(false);
		expect(scene?.note).toBe('20 five-star ratings out of 20 rated films.');
	});

	it('counts a film by its rated diary entry even when its current rating is null', () => {
		// One film here is rated 5 on its diary entry but carries no current `rating` (Letterboxd
		// tracks a rating per viewing, not only a current rating per film — `ratingInYear` exists to
		// read the former). `watched()` sets the entry's rating without touching `film.rating`, so
		// omitting `rating` from `film()` leaves it null while the entry is still rated.
		const noCurrentRating = film({ ...watched(['2025-05-01'], 5) });
		const films = [...yearOf(2025, 19, 5), noCurrentRating];
		const scene = fiveStarScene(buildWrapped(films, 2025)!);
		// Hand-derived: ratingInYear counts all 20 entries (19 with a current rating + this one
		// without), so `top.count` = 20, `top.rated` = 20, share = 20/20 = 100%. A denominator built
		// from `film.rating !== null` instead would give 19, reading "20 out of 19" against a 100%
		// share it cannot support.
		expect(scene?.stats.find((s) => s.label === 'Share')?.value).toBe('100%');
		expect(scene?.note).toBe('20 five-star ratings out of 20 rated films.');
	});
});

describe('driftScene', () => {
	it('reports a rating that moved between viewings', () => {
		const scene = driftScene(data());
		expect(scene).toMatchObject({ id: 'drift', valueKind: 'name', value: 'Paddington 2' });
		expect(scene?.note).toContain('★ 3');
		expect(scene?.note).toContain('★ 4.5');
		// Full string pins the before/after ordering: before is the earliest entry (2019, ★3.00),
		// after is this year's (★4.50) — a swapped formula would flip which year sits next to which star.
		expect(scene?.note).toBe(
			'You gave it ★ 3.00 in 2019 and ★ 4.50 this time. 1 film in your diary changed your mind this year.'
		);
		expect(scene?.stats).toEqual([
			{ label: 'Then', value: '★ 3.00' },
			{ label: 'Now', value: '★ 4.50' },
			{ label: 'Moved by', value: '+1.5' }
		]);
		expect(scene?.label).toBe('It grew on you');
	});

	it('reports a rating that fell, and does not swap before/after when it drops', () => {
		const declined = film({
			name: 'Cool at First',
			watchedDates: ['2020-05-01', '2025-07-01'],
			entries: [
				{ date: '2020-05-01', rating: 4.5, rewatch: false },
				{ date: '2025-07-01', rating: 3, rewatch: true }
			]
		});
		const films = [...yearOf(2025, 12), declined];
		const scene = driftScene(buildWrapped(films, 2025)!);
		expect(scene?.label).toBe('It did not hold up');
		expect(scene?.note).toBe(
			'You gave it ★ 4.50 in 2020 and ★ 3.00 this time. 1 film in your diary changed your mind this year.'
		);
		expect(scene?.stats).toEqual([
			{ label: 'Then', value: '★ 4.50' },
			{ label: 'Now', value: '★ 3.00' },
			{ label: 'Moved by', value: '-1.5' }
		]);
	});

	it('drops out when no film has two rated entries', () => {
		expect(driftScene(buildWrapped(yearOf(2025, 12), 2025)!)).toBeNull();
	});

	it('drops out when the widest rating move is under a full star', () => {
		const small = film({
			watchedDates: ['2024-01-01', '2025-01-01'],
			entries: [
				{ date: '2024-01-01', rating: 3.5, rewatch: false },
				{ date: '2025-01-01', rating: 4, rewatch: true }
			]
		});
		const films = [...yearOf(2025, 12), small];
		expect(driftScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});

describe('firstTimersScene', () => {
	it('counts directors new to the export', () => {
		const sciamma = { name: 'Céline Sciamma', tmdbId: 7, profilePath: null };
		// Padded with plain, director-less films so the 2025 slice clears MIN_FILMS (10); the brief's
		// three-film slice alone is below that bar and buildWrapped would return null.
		const filler = yearOf(2025, 7);
		const films = [
			...yearOf(2024, 12),
			...filler,
			...Array.from({ length: 3 }, () =>
				film({ ...watched(['2025-04-01']), rating: 4, tmdb: tmdb({ directors: [sciamma] }) })
			)
		];
		const scene = firstTimersScene(buildWrapped(films, 2025)!);
		expect(scene).toMatchObject({ id: 'first-timers', value: '1' });
		expect(scene?.note).toContain('Céline Sciamma');
		// Full string: catches the "of theirs" -> "of theirss" pluralisation bug at count > 1.
		expect(scene?.note).toBe(
			'1 director you had never logged before. Céline Sciamma arrived this year and you watched 3 of theirs.'
		);
	});

	it('drops out when nothing was logged before this year', () => {
		const person = { name: 'Test Director', tmdbId: 99, profilePath: null };
		const films = Array.from({ length: 10 }, () =>
			film({ ...watched(['2025-04-01']), rating: 4, tmdb: tmdb({ directors: [person] }) })
		);
		expect(firstTimersScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('drops out when every director this year was already logged before', () => {
		const person = { name: 'Returning Director', tmdbId: 55, profilePath: null };
		const priorFilm = film({ ...watched(['2020-01-01']), tmdb: tmdb({ directors: [person] }) });
		const thisYearFilms = Array.from({ length: 10 }, () =>
			film({ ...watched(['2025-04-01']), rating: 4, tmdb: tmdb({ directors: [person] }) })
		);
		const films = [priorFilm, ...thisYearFilms];
		expect(firstTimersScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});
