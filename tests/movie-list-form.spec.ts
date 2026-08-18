import { describe, expect, it } from 'vitest';
import { validateMovieListForm } from '$lib/server/movie-list-form';

const makeForm = (items: unknown, name = 'Weekend picks') => {
	const form = new FormData();
	form.set('name', name);
	form.set('description', 'A shared list');
	form.set('items', JSON.stringify(items));
	return form;
};

describe('validateMovieListForm', () => {
	it('accepts a complete title with optional poster and rating omitted', () => {
		const result = validateMovieListForm(
			makeForm([
				{
					title: 'Arrival',
					type: 'movie',
					genres: ['Drama', 'Sci-Fi'],
					year: 2016
				}
			])
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected a valid list');
		expect(result.items).toEqual([
			{
				title: 'Arrival',
				type: 'movie',
				genres: ['Drama', 'Sci-Fi'],
				year: 2016,
				img: '',
				imdbRating: 0,
				plot: ''
			}
		]);
	});

	it('accepts a readable optional plot and rejects one longer than 360 characters', () => {
		const item = {
			title: 'Arrival',
			type: 'movie',
			genres: ['Drama', 'Sci-Fi'],
			year: 2016,
			plot: 'A linguist works with the military to communicate with mysterious visitors.'
		};
		const valid = validateMovieListForm(makeForm([item]));
		expect(valid.ok).toBe(true);

		const invalid = validateMovieListForm(makeForm([{ ...item, plot: 'x'.repeat(361) }]));
		expect(invalid.ok).toBe(false);
		if (invalid.ok) throw new Error('Expected an invalid list');
		expect(invalid.message).toContain('plot" cannot exceed 360 characters');
	});

	it.each([
		['title', { title: '', type: 'movie', genres: ['Drama'], year: 2020 }],
		['type', { title: 'Title', type: '', genres: ['Drama'], year: 2020 }],
		['genres', { title: 'Title', type: 'movie', genres: [], year: 2020 }],
		['year', { title: 'Title', type: 'movie', genres: ['Drama'] }]
	])('rejects a record without a valid required %s', (_field, item) => {
		const result = validateMovieListForm(makeForm([item]));
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected an invalid list');
		expect(result.status).toBe(400);
	});

	it('rejects an optional rating outside the IMDb range', () => {
		const result = validateMovieListForm(
			makeForm([
				{
					title: 'Arrival',
					type: 'movie',
					genres: ['Drama'],
					year: 2016,
					imdbRating: 11
				}
			])
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected an invalid list');
		expect(result.message).toContain('0 to 10');
	});

	it.each([
		[['Action', 'Adventure', 'Drama', 'Thriller'], 'no more than 3 genres'],
		[['Drama', 'Superhero'], 'Unknown genre: Superhero'],
		[['Drama', 'drama'], 'duplicate genre “Drama”']
	])('rejects invalid genres submitted to the server', (genres, message) => {
		const result = validateMovieListForm(
			makeForm([{ title: 'Title', type: 'movie', genres, year: 2020 }])
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected an invalid list');
		expect(result.message).toContain(message);
	});
});
