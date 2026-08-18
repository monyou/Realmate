import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import GenerateListPage from '../src/routes/profile/lists/generate/+page.svelte';

describe('generate list page', () => {
	it('renders the complete criteria form and restores server-side values', () => {
		const { body } = render(GenerateListPage, {
			props: {
				form: {
					message: 'Try a broader rating range.',
					values: {
						type: 'series',
						yearOperator: '<=',
						year: '2020',
						genres: ['Drama', 'Mystery'],
						ratingOperator: '>=',
						rating: '8',
						limit: '9'
					}
				}
			}
		});

		expect(body).toContain('Set the vibe.');
		expect(body).toContain('Try a broader rating range.');
		expect(body).toContain('name="type" value="series" checked');
		expect(body).toContain('name="genres" value="Drama"');
		expect(body).toContain('name="genres" value="Mystery"');
		expect(body).toContain('name="year"');
		expect(body).toContain('name="rating"');
		expect(body).toContain('name="limit"');
		expect(body).toContain('Generate list');
		expect(body).toContain('Titles with an unknown rating may still be included.');
		expect(body).toContain('Every title must contain all selected genres.');
		expect(body).toContain('saves the valid titles it found');
		expect(body).toContain('TMDB list studio');
		expect(body).not.toContain('AI');
		expect(body).not.toContain('Gemini');
		expect(body).not.toContain('IMDb');
	});
});
