import { describe, expect, it } from 'vitest';
import { film, omdb, tmdb, watched } from '$lib/testing/fixtures';
import { buildWrapped } from '../wrapped';
import { criticScene, languageScene, obscurityScene } from './audience';

const many = (over: (i: number) => Parameters<typeof film>[0], count = 26) =>
	Array.from({ length: count }, (_, i) =>
		film({ ...watched([`2025-0${(i % 9) + 1}-1${i % 9}`]), ...over(i) })
	);

describe('obscurityScene', () => {
	it('reports the median vote count across the year', () => {
		const films = many((i) => ({ tmdb: tmdb({ voteCount: (i + 1) * 500 }) }));
		const scene = obscurityScene(buildWrapped(films, 2025)!);
		expect(scene?.id).toBe('obscurity');
		expect(scene?.note).toContain('Half');
	});

	it('drops out under twenty-five films with a vote count', () => {
		const films = many((i) => ({ tmdb: tmdb({ voteCount: i < 5 ? 100 : null }) }), 12);
		expect(obscurityScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});

describe('languageScene', () => {
	it('measures against the language of the viewer', () => {
		const films = many((i) => ({ tmdb: tmdb({ originalLanguage: i < 10 ? 'fr' : 'de' }) }), 20);
		const scene = languageScene(buildWrapped(films, 2025, { locale: 'de-DE' })!);
		expect(scene?.label).toBe('Not in German');
		expect(scene?.value).toBe('50%');
		expect(scene?.note).toBe(
			'10 of 20 films were in a language other than German. French did most of the work, at 10.'
		);
	});

	it('drops out when almost everything was in the viewer’s language', () => {
		const films = many((i) => ({ tmdb: tmdb({ originalLanguage: i === 0 ? 'fr' : 'en' }) }), 20);
		expect(languageScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('drops out under fifteen films with a language on record', () => {
		const films = many(
			(i) => (i < 10 ? { tmdb: tmdb({ originalLanguage: i < 5 ? 'fr' : 'en' }) } : {}),
			20
		);
		expect(languageScene(buildWrapped(films, 2025)!)).toBeNull();
	});

	it('omits the "did most of the work" sentence when no single other language stands out', () => {
		// 'iw' and 'he' are distinct ISO codes that both display as "Hebrew", so the foreign
		// group collapses into the viewer's own label and `largest` comes back null.
		const films = many((i) => ({ tmdb: tmdb({ originalLanguage: i < 15 ? 'iw' : 'he' }) }), 20);
		const scene = languageScene(buildWrapped(films, 2025, { locale: 'iw' })!);
		expect(scene?.note).toBe('5 of 20 films were in a language other than Hebrew.');
	});

	it('counts every distinct language, not just the five shown in the bar chart', () => {
		// Six non-English languages plus English is seven distinct languages, but the bar
		// row caps at five: a fixture where those two numbers differ tells the fixed
		// `languages` field apart from the display-capped `shownBars.length` it replaced.
		const codes = ['en', 'fr', 'de', 'es', 'it', 'ja', 'ko'];
		const counts = [5, 10, 8, 6, 4, 3, 2];
		const languages: string[] = [];
		counts.forEach((count, index) => {
			for (let n = 0; n < count; n += 1) languages.push(codes[index]);
		});
		const films = many(
			(i) => ({ tmdb: tmdb({ originalLanguage: languages[i] }) }),
			languages.length
		);
		const scene = languageScene(buildWrapped(films, 2025)!);
		expect(scene?.stats).toEqual([
			{ label: 'Languages', value: '7' },
			{ label: 'Largest non-English', value: 'French, 10' },
			{ label: 'English', value: '5' }
		]);
		expect(scene?.body.kind === 'bars' && scene.body.bars).toHaveLength(5);
	});
});

describe('criticScene', () => {
	it('names the film you and the critics disagreed on most', () => {
		const films = [
			film({
				name: 'Speak No Evil',
				...watched(['2025-05-01']),
				rating: 4.5,
				omdb: omdb({ metascore: 34 })
			}),
			...many(() => ({ rating: 3, omdb: omdb({ metascore: 60 }) }), 11)
		];
		const scene = criticScene(buildWrapped(films, 2025)!);
		expect(scene).toMatchObject({ id: 'critics', value: 'Speak No Evil' });
		expect(scene?.note).toBe(
			'Critics put it at 34 on Metascore. You gave it ★ 4.50. That is the widest you and the critics stood apart all year.'
		);
		expect(scene?.stats).toContainEqual({ label: 'You were kinder on', value: '1 film' });
	});

	it('credits the harsher side when you rated below the critics', () => {
		const films = [
			film({
				name: 'Movie We Hated',
				...watched(['2025-05-01']),
				rating: 1,
				omdb: omdb({ metascore: 90 })
			}),
			...many(() => ({ rating: 3, omdb: omdb({ metascore: 60 }) }), 11)
		];
		const scene = criticScene(buildWrapped(films, 2025)!);
		expect(scene).toMatchObject({ id: 'critics', value: 'Movie We Hated' });
		expect(scene?.stats).toContainEqual({ label: 'You were harsher on', value: '1 film' });
	});

	it('drops out without OMDb', () => {
		expect(
			criticScene(
				buildWrapped(
					many(() => ({ rating: 4 }), 12),
					2025
				)!
			)
		).toBeNull();
	});

	it('drops out when the widest gap stays under thirty points', () => {
		const films = many(() => ({ rating: 3, omdb: omdb({ metascore: 50 }) }), 12);
		expect(criticScene(buildWrapped(films, 2025)!)).toBeNull();
	});
});
