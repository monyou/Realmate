import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MovieListEditor from '$lib/components/MovieListEditor.svelte';

describe('MovieListEditor', () => {
	it('starts a new list expanded without showing validation feedback', () => {
		const { body } = render(MovieListEditor, { props: { mode: 'create' } });

		expect(body).toContain('<details open=""');
		expect(body).toContain('novalidate=""');
		expect(body).not.toContain('Title is required.');
		expect(body).not.toContain('Type is required.');
		expect(body).not.toContain('At least one genre is required.');
		expect(body).not.toContain('Year is required.');
		expect(body).not.toMatch(/<button type="submit" disabled=""[^>]*>Create list/);
	});

	it('prefills a complete list in edit mode', () => {
		const { body } = render(MovieListEditor, {
			props: {
				mode: 'edit',
				initialName: 'Science fiction',
				initialDescription: 'Space stories',
				initialItems: [
					{
						title: 'Arrival',
						type: 'movie',
						genres: ['Drama', 'Sci-Fi'],
						img: '',
						year: 2016,
						imdbRating: 0
					}
				]
			}
		});

		expect(body).toContain('Edit list');
		expect(body).toContain('value="Science fiction"');
		expect(body).toContain('value="Arrival"');
		expect(body).toContain('value="Drama, Sci-Fi"');
		expect(body).not.toContain('<details open=""');
		expect(body).not.toContain('Title is required.');
		expect(body).not.toMatch(/<button type="submit" disabled=""[^>]*>Save changes/);
	});

	it('keeps the submitted version and blocks another save after an edit conflict', () => {
		const { body } = render(MovieListEditor, {
			props: {
				mode: 'edit',
				expectedUpdatedAt: 'newer-version',
				form: {
					conflict: true,
					message: 'Refresh the page.',
					values: {
						name: 'Stale edit',
						description: '',
						itemsJson: '[]',
						expectedUpdatedAt: 'stale-version'
					}
				}
			}
		});

		expect(body).toContain('name="expectedUpdatedAt" value="stale-version"');
		expect(body).toMatch(/<button type="submit" disabled=""[^>]*>Refresh required/);
	});
});
