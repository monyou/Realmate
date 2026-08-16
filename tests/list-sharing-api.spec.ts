import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
	requireUser: vi.fn(),
	requireSupabase: vi.fn()
}));

vi.mock('$lib/server/auth', () => auth);

import { GET, PUT } from '../src/routes/api/lists/[id]/shares/+server';

const listId = '09d4779e-236d-44f8-af8b-a6cc35e769f4';

describe('list sharing API', () => {
	const rpc = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		auth.requireUser.mockResolvedValue({ id: 'owner-id', email: 'owner@example.com' });
		auth.requireSupabase.mockReturnValue({ rpc });
	});

	it('loads the current collaborator emails for the owner', async () => {
		rpc.mockResolvedValue({ data: [{ email: 'friend@example.com' }], error: null });

		const response = (await GET({
			locals: {},
			params: { id: listId },
			setHeaders: vi.fn()
		} as never)) as Response;

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ emails: ['friend@example.com'] });
		expect(rpc).toHaveBeenCalledWith('get_movie_list_share_emails', {
			target_list_id: listId
		});
	});

	it('normalizes and deduplicates emails before syncing the exact recipient set', async () => {
		rpc.mockResolvedValue({ data: [{ email: 'friend@example.com' }], error: null });

		const response = (await PUT({
			request: new Request(`http://localhost/api/lists/${listId}/shares`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					emails: [' Friend@Example.com ', 'friend@example.com']
				})
			}),
			locals: {},
			params: { id: listId },
			setHeaders: vi.fn()
		} as never)) as Response;

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith('sync_movie_list_shares', {
			target_list_id: listId,
			recipient_emails: ['friend@example.com']
		});
	});

	it('returns a useful validation error when an email has no account', async () => {
		rpc.mockResolvedValue({
			data: null,
			error: { code: 'P0001', message: 'No account found for: missing@example.com' }
		});

		const response = (await PUT({
			request: new Request(`http://localhost/api/lists/${listId}/shares`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ emails: ['missing@example.com'] })
			}),
			locals: {},
			params: { id: listId },
			setHeaders: vi.fn()
		} as never)) as Response;

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			message: 'No account found for: missing@example.com'
		});
	});
});
