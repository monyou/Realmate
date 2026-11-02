import { describe, expect, it, vi } from 'vitest';
import { ListSharingEditor } from '#lib/list-sharing.svelte.js';

const deferred = () => {
	let resolve!: (value: Response) => void;
	const promise = new Promise<Response>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
};

describe('list sharing editor', () => {
	it('blocks saving and adding recipients after a failed or malformed read', async () => {
		for (const response of [
			Response.json({ message: 'Unavailable' }, { status: 503 }),
			Response.json({})
		]) {
			const fetcher = vi.fn(async () => response);
			const editor = new ListSharingEditor(fetcher);
			await editor.open('a');
			editor.addEmail();
			const onSaved = vi.fn();
			await editor.save('a', onSaved);
			expect(editor.canSave('a')).toBe(false);
			expect(editor.rows).toHaveLength(0);
			expect(fetcher).toHaveBeenCalledTimes(1);
			expect(onSaved).not.toHaveBeenCalled();
		}
	});

	it('recovers through retry after a network failure without treating it as an empty share list', async () => {
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValueOnce(Response.json({ emails: ['friend@example.com'] }));
		const editor = new ListSharingEditor(fetcher);
		await editor.open('a');
		expect(editor.canSave('a')).toBe(false);
		expect(editor.message).toBe('Sharing settings could not be loaded. Try again.');
		await editor.open('a');
		expect(editor.canSave('a')).toBe(true);
		expect(editor.message).toBe('');
		expect(editor.rows[0].email).toBe('friend@example.com');
		editor.close();
	});

	it('ignores a late read for an earlier list even if transport ignores cancellation', async () => {
		const oldRead = deferred();
		const fetcher = vi
			.fn()
			.mockImplementationOnce(() => oldRead.promise)
			.mockResolvedValueOnce(Response.json({ emails: ['b@example.com'] }));
		const editor = new ListSharingEditor(fetcher);
		const loadingOld = editor.open('a');
		await editor.open('b');
		oldRead.resolve(Response.json({ emails: ['a@example.com'] }));
		await loadingOld;
		expect(editor.loadedListId).toBe('b');
		expect(editor.rows.map((row) => row.email)).toEqual(['b@example.com']);
		expect(editor.canSave('a')).toBe(false);
		const oldSignal = fetcher.mock.calls[0][1].signal as AbortSignal;
		expect(oldSignal.aborted).toBe(true);
		editor.close();
	});

	it('allows intentional removal of all recipients only after a successful read', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ emails: ['friend@example.com'] }))
			.mockResolvedValueOnce(Response.json({ emails: [] }));
		const editor = new ListSharingEditor(fetcher);
		await editor.open('a');
		editor.removeEmail(editor.rows[0].key);
		const onSaved = vi.fn(async () => {});
		await editor.save('a', onSaved);
		expect(fetcher).toHaveBeenLastCalledWith(
			'/api/lists/a/shares',
			expect.objectContaining({
				method: 'PUT',
				body: JSON.stringify({ emails: [] })
			})
		);
		expect(onSaved).toHaveBeenCalledOnce();
		editor.close();
	});

	it('does not close or update a different dialog after an earlier save completes', async () => {
		const oldSave = deferred();
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ emails: ['a@example.com'] }))
			.mockImplementationOnce(() => oldSave.promise)
			.mockResolvedValueOnce(Response.json({ emails: ['b@example.com'] }));
		const editor = new ListSharingEditor(fetcher);
		await editor.open('a');
		const onSaved = vi.fn(async () => {});
		const savingOld = editor.save('a', onSaved);
		await editor.open('b');
		oldSave.resolve(Response.json({ emails: ['a@example.com'] }));
		await savingOld;
		expect(onSaved).not.toHaveBeenCalled();
		expect(editor.loadedListId).toBe('b');
		expect(editor.rows[0].email).toBe('b@example.com');
		expect(editor.saving).toBe(false);
		editor.close();
	});

	it('keeps edits available for retry after a save failure', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ emails: ['friend@example.com'] }))
			.mockResolvedValueOnce(Response.json({ message: 'Try again' }, { status: 503 }));
		const editor = new ListSharingEditor(fetcher);
		await editor.open('a');
		editor.rows[0].email = 'new@example.com';
		await editor.save('a', vi.fn());
		expect(editor.rows[0].email).toBe('new@example.com');
		expect(editor.canSave('a')).toBe(true);
		expect(editor.message).toBe('Try again');
		editor.close();
	});
});
