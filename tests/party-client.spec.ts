import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchParty, PartyRequestError } from '#lib/party-client.js';

afterEach(() => vi.useRealTimers());

const waitingFetch = vi.fn(
	(_input: string | URL | Request, init?: RequestInit) =>
		new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () =>
				reject(new DOMException('Aborted', 'AbortError'))
			);
		})
);

describe('party request lifecycle', () => {
	it('bounds a stalled request and tells the caller it can retry', async () => {
		vi.useFakeTimers();
		const result = fetchParty(
			'/api/party?room=a',
			new AbortController().signal,
			undefined,
			waitingFetch
		);
		const failure = expect(result).rejects.toThrow('took too long');
		await vi.advanceTimersByTimeAsync(10_000);
		await failure;
		expect(vi.getTimerCount()).toBe(0);
	});

	it('cancels the request when leaving the session and clears its timeout', async () => {
		vi.useFakeTimers();
		const session = new AbortController();
		const result = fetchParty('/api/party?room=a', session.signal, undefined, waitingFetch);
		const failure = expect(result).rejects.toMatchObject({ name: 'AbortError' });
		session.abort();
		await failure;
		expect(vi.getTimerCount()).toBe(0);
	});

	it('preserves missing-room status and vote payloads for recovery and retry', async () => {
		const fetcher = vi.fn(async () => Response.json({ message: 'Room expired.' }, { status: 404 }));
		const action = { type: 'vote' as const, roundId: 'round', itemId: 'title', liked: true };
		await expect(
			fetchParty('/api/party?room=a', new AbortController().signal, action, fetcher)
		).rejects.toEqual(new PartyRequestError('Room expired.', 404));
		expect(fetcher).toHaveBeenCalledWith(
			'/api/party?room=a',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify(action),
				keepalive: true,
				cache: 'no-store'
			})
		);
	});
});
