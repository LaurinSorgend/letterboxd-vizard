import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseExport } from './parse';

function zip(files: Record<string, string>): Uint8Array {
	return zipSync(
		Object.fromEntries(Object.entries(files).map(([name, body]) => [name, strToU8(body)]))
	);
}

const WATCHED = 'Date,Name,Year,Letterboxd URI\n2019-03-01,Stalker,1979,https://boxd.it/a\n';

describe('parseExport diary', () => {
	it('keeps the rating recorded on each diary row', () => {
		const diary =
			'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
			'2019-03-02,Stalker,1979,https://boxd.it/d1,3,No,,2019-03-01\n' +
			'2025-04-13,Stalker,1979,https://boxd.it/d2,4.5,Yes,cinema,2025-04-12\n';
		const { films } = parseExport(zip({ 'watched.csv': WATCHED, 'diary.csv': diary }));
		expect(films).toHaveLength(1);
		expect(films[0].entries).toEqual([
			{ date: '2019-03-01', rating: 3, rewatch: false },
			{ date: '2025-04-12', rating: 4.5, rewatch: true }
		]);
		expect(films[0].watchedDates).toEqual(['2019-03-01', '2025-04-12']);
		expect(films[0].rewatch).toBe(true);
		expect(films[0].tags).toEqual(['cinema']);
	});

	it('records a null rating when the diary row has none', () => {
		const diary =
			'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
			'2025-01-05,Stalker,1979,https://boxd.it/d3,,No,,2025-01-04\n';
		const { films } = parseExport(zip({ 'watched.csv': WATCHED, 'diary.csv': diary }));
		expect(films[0].entries).toEqual([{ date: '2025-01-04', rating: null, rewatch: false }]);
	});

	it('leaves entries empty for a film that was never diary-logged', () => {
		const { films } = parseExport(zip({ 'watched.csv': WATCHED }));
		expect(films[0].entries).toEqual([]);
	});
});

describe('parseExport watchlist', () => {
	it('carries the date each film was added', () => {
		const watchlist =
			'Date,Name,Year,Letterboxd URI\n' +
			'2021-06-02,Stalker,1979,https://boxd.it/w1\n' +
			'2025-02-11,Nosferatu,2024,https://boxd.it/w2\n';
		const data = parseExport(zip({ 'watched.csv': WATCHED, 'watchlist.csv': watchlist }));
		expect(data.watchlist).toEqual([
			{ uri: 'https://boxd.it/w1', name: 'Stalker', year: 1979, added: '2021-06-02' },
			{ uri: 'https://boxd.it/w2', name: 'Nosferatu', year: 2024, added: '2025-02-11' }
		]);
	});

	it('records a null date when the export omits the column', () => {
		const watchlist = 'Name,Year,Letterboxd URI\nStalker,1979,https://boxd.it/w1\n';
		const data = parseExport(zip({ 'watched.csv': WATCHED, 'watchlist.csv': watchlist }));
		expect(data.watchlist[0].added).toBeNull();
	});
});
