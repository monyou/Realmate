import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
	requireUser: vi.fn(),
	requireSupabase: vi.fn()
}));
const generatedList = vi.hoisted(() => ({
	validateGenerationCriteria: vi.fn(),
	generateListFromTmdb: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({
	env: { TMDB_API_READ_ACCESS_TOKEN: 'server-only-tmdb-token' }
}));
vi.mock('$lib/server/auth', () => auth);
vi.mock('$lib/server/generated-list', () => ({
	ListGenerationError: class ListGenerationError extends Error {},
	validateGenerationCriteria: generatedList.validateGenerationCriteria,
	generateListFromTmdb: generatedList.generateListFromTmdb
}));

import { actions } from '../src/routes/profile/lists/generate/+page.server';

describe('generate list action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		auth.requireUser.mockResolvedValue({ id: 'owner-id' });
		generatedList.validateGenerationCriteria.mockReturnValue({
			ok: true,
			values: {},
			criteria: {
				type: 'movie',
				yearOperator: '>=',
				year: 2010,
				genres: ['Sci-Fi'],
				ratingOperator: '>=',
				rating: 7,
				limit: 2
			}
		});
		generatedList.generateListFromTmdb.mockResolvedValue({
			name: 'Generated Sci-Fi movies · ABC123',
			description: 'Randomly generated from matching TMDB results.',
			itemsJson: [
				{
					title: 'Arrival',
					type: 'movie',
					genres: ['Drama', 'Sci-Fi'],
					year: 2016,
					img: '',
					imdbRating: 7.6,
					ratingSource: 'TMDB',
					plot: 'A linguist works to communicate with visitors from another world.'
				}
			]
		});
	});

	it('saves randomized TMDB results for the authenticated owner and redirects', async () => {
		const insert = vi.fn().mockResolvedValue({ error: null });
		const from = vi.fn().mockReturnValue({ insert });
		auth.requireSupabase.mockReturnValue({ from });
		const action = actions.default;
		if (!action) throw new Error('Generate action is missing');

		await expect(
			action({
				request: new Request('http://localhost/profile/lists/generate', {
					method: 'POST',
					body: new FormData()
				}),
				locals: {}
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/profile' });

		expect(generatedList.generateListFromTmdb).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'movie', genres: ['Sci-Fi'] }),
			'server-only-tmdb-token'
		);
		expect(from).toHaveBeenCalledWith('movie_lists');
		expect(insert).toHaveBeenCalledWith({
			user_id: 'owner-id',
			name: 'Generated Sci-Fi movies · ABC123',
			description: 'Randomly generated from matching TMDB results.',
			items: [
				{
					title: 'Arrival',
					type: 'movie',
					genres: ['Drama', 'Sci-Fi'],
					year: 2016,
					img: '',
					imdbRating: 7.6,
					ratingSource: 'TMDB',
					plot: 'A linguist works to communicate with visitors from another world.'
				}
			]
		});
	});
});
