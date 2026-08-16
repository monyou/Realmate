import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
	requireUser: vi.fn(),
	requireSupabase: vi.fn()
}));

vi.mock('$lib/server/auth', () => auth);

import { actions as editActions } from '../src/routes/profile/lists/[id]/edit/+page.server';
import { actions as profileActions } from '../src/routes/profile/+page.server';

const listId = '09d4779e-236d-44f8-af8b-a6cc35e769f4';
const version = '2026-08-17T10:00:00.000Z';

const validEditRequest = () => {
	const form = new FormData();
	form.set('name', 'Weekend picks');
	form.set('description', 'For Saturday');
	form.set('expectedUpdatedAt', version);
	form.set(
		'items',
		JSON.stringify([
			{
				title: 'Dune: Part Two',
				type: 'movie',
				genres: ['Drama', 'Sci-Fi'],
				img: '',
				year: 2024,
				imdbRating: 0
			}
		])
	);
	return new Request(`http://localhost/profile/lists/${listId}/edit`, {
		method: 'POST',
		body: form
	});
};

describe('list mutation actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		auth.requireUser.mockResolvedValue({ id: 'owner-id', email: 'owner@example.com' });
	});

	it('rejects a stale edit instead of overwriting a newer version', async () => {
		const query = {
			update: vi.fn(),
			eq: vi.fn(),
			select: vi.fn(),
			maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
		};
		query.update.mockReturnValue(query);
		query.eq.mockReturnValue(query);
		query.select.mockReturnValue(query);
		auth.requireSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

		const action = editActions.default;
		if (!action) throw new Error('Edit action is missing');
		const result = await action({
			request: validEditRequest(),
			locals: {},
			params: { id: listId }
		} as never);

		expect(query.eq).toHaveBeenCalledWith('updated_at', version);
		expect(result).toMatchObject({
			status: 409,
			data: {
				message: expect.stringContaining('Refresh the page'),
				conflict: true,
				values: { expectedUpdatedAt: version }
			}
		});
	});

	it('scopes deletion to the authenticated owner', async () => {
		const query = {
			delete: vi.fn(),
			eq: vi.fn(),
			select: vi.fn(),
			maybeSingle: vi.fn().mockResolvedValue({ data: { id: listId }, error: null })
		};
		query.delete.mockReturnValue(query);
		query.eq.mockReturnValue(query);
		query.select.mockReturnValue(query);
		auth.requireSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

		const form = new FormData();
		form.set('listId', listId);
		const action = profileActions.deleteList;
		if (!action) throw new Error('Delete action is missing');
		const result = await action({
			request: new Request('http://localhost/profile?/deleteList', {
				method: 'POST',
				body: form
			}),
			locals: {}
		} as never);

		expect(query.eq).toHaveBeenCalledWith('id', listId);
		expect(query.eq).toHaveBeenCalledWith('user_id', 'owner-id');
		expect(result).toEqual({ deleted: true });
	});
});
