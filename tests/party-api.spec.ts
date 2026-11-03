import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartyState } from '#lib/types.js';

const store = vi.hoisted(() => ({
	readParty: vi.fn(),
	mutateParty: vi.fn(),
	PartyNotFoundError: class extends Error {}
}));
vi.mock('#lib/server/party-store.js', () => store);
vi.mock('#lib/server/player-identity.js', () => ({ getPlayerIdentity: () => 'a' }));
import { GET, POST } from '../src/routes/api/party/+server';

const state: PartyState = {
	revision: 4,
	roundId: 'round-a',
	phase: 'playing',
	onlineCount: 2,
	players: [],
	match: null,
	message: null,
	deck: [
		{
			id: 'movie',
			title: 'Arrival',
			type: 'movie',
			genres: ['Sci-Fi'],
			year: 2016,
			img: '',
			imdbRating: 0
		}
	]
};

describe('party API response compatibility', () => {
	beforeEach(() => {
		store.readParty.mockResolvedValue(state);
		store.mutateParty.mockResolvedValue(state);
	});

	it.each([GET, POST])(
		'returns full snapshots to existing clients and compact updates to clients with the deck',
		async (handler) => {
			const request = () =>
				new Request('http://localhost/api/party', {
					method: 'POST',
					body: JSON.stringify({ type: 'hello' })
				});
			const full = (await handler({
				cookies: {},
				url: new URL('http://localhost/api/party?room=abc'),
				request: request()
			} as never)) as Response;
			expect(await full.json()).toEqual({ playerId: 'a', state });
			const compact = (await handler({
				cookies: {},
				url: new URL('http://localhost/api/party?room=abc&knownRound=round-a'),
				request: request()
			} as never)) as Response;
			const body = await compact.json();
			expect(body.state).not.toHaveProperty('deck');
			expect(body.state.revision).toBe(state.revision);
			expect(compact.headers.get('cache-control')).toContain('no-store');
		}
	);
});
