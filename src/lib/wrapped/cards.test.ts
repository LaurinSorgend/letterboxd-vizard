import { describe, expect, it } from 'vitest';
import { statColumns } from './cards';

/** Monospace-style widths: sixteen pixels a character, whatever the size. */
const measure = (text: string) => text.length * 16;

describe('statColumns', () => {
	it('spaces stat columns wide enough that a long label never overlaps the next one', () => {
		const [share, mostUsed, inYear] = statColumns(
			[
				{ label: 'Share', value: '10%' },
				{ label: 'Most-used rating', value: '★ 4.5' },
				{ label: 'In 2024', value: '21' }
			],
			measure
		);
		expect(mostUsed.x).toBeGreaterThanOrEqual(share.x + 200);
		expect(inYear.x).toBeGreaterThanOrEqual(mostUsed.x + measure('Most-used rating'));
	});

	it('shows three stats at most and shortens a long value', () => {
		const columns = statColumns(
			[
				{ label: 'A', value: 'A value far too long for its column' },
				{ label: 'B', value: '2' },
				{ label: 'C', value: '3' },
				{ label: 'D', value: '4' }
			],
			measure
		);
		expect(columns).toHaveLength(3);
		expect(columns[0].value).toBe('A value far too l…');
	});
});
