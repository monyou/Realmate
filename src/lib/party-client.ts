import type { PartyResponse } from '#lib/party-response.js';

export type PartyAction =
	| { type: 'hello'; name: string }
	| { type: 'start' }
	| { type: 'vote'; roundId: string; itemId: string; liked: boolean }
	| { type: 'again'; roundId: string }
	| { type: 'leave' };

export class PartyRequestError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'PartyRequestError';
	}
}

export async function fetchParty(
	url: string,
	signal: AbortSignal,
	action?: PartyAction,
	fetcher: typeof fetch = fetch
): Promise<PartyResponse> {
	signal.throwIfAborted();
	const request = new AbortController();
	const abort = () => request.abort();
	signal.addEventListener('abort', abort, { once: true });
	const timeout = setTimeout(() => request.abort(), 10_000);
	try {
		const response = await fetcher(url, {
			method: action ? 'POST' : 'GET',
			headers: action ? { 'content-type': 'application/json' } : undefined,
			body: action ? JSON.stringify(action) : undefined,
			cache: 'no-store',
			keepalive: action?.type === 'vote',
			signal: request.signal
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			throw new PartyRequestError(
				body?.message ?? 'The party room is unavailable. Please try again.',
				response.status
			);
		}
		return await response.json();
	} catch (error) {
		if (!signal.aborted && request.signal.aborted) {
			throw new Error('The party room took too long to respond. Please try again.', {
				cause: error
			});
		}
		throw error;
	} finally {
		clearTimeout(timeout);
		signal.removeEventListener('abort', abort);
	}
}
