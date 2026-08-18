import { describe, expect, it } from 'vitest';
import { MAX_MEDIA_PLOT_LENGTH, normalizeMediaPlot, truncateMediaPlot } from '$lib/media-plot';

describe('media plot', () => {
	it('trims manually entered plots without changing their content', () => {
		expect(normalizeMediaPlot('  First line.\nSecond line.  ')).toBe('First line.\nSecond line.');
	});

	it('normalizes and truncates API overviews at a readable word boundary', () => {
		const result = truncateMediaPlot(`  ${'A readable sentence. '.repeat(30)}  `);

		expect(result.length).toBeLessThanOrEqual(MAX_MEDIA_PLOT_LENGTH);
		expect(result.endsWith('…')).toBe(true);
		expect(result).not.toContain('\n');
	});

	it('returns an empty plot when the API has no overview', () => {
		expect(truncateMediaPlot(undefined)).toBe('');
		expect(truncateMediaPlot('   ')).toBe('');
	});
});
