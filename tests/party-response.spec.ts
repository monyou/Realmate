import { describe, expect, it } from 'vitest';
import { PartyEngine } from '#lib/server/party-engine.js';
import { partyResponse, restorePartyState } from '#lib/party-response.js';

const makeRoom = () => {
	const room = new PartyEngine([
		{ title: 'Arrival', type: 'movie', genres: ['Sci-Fi'], year: 2016 }
	]);
	room.connect('a', 'A');
	room.connect('b', 'B');
	room.start({ playerId: 'a' });
	return room;
};

describe('party response decks', () => {
	it('sends a full deck to new clients and sends updates to clients with the same round', () => {
		const room = makeRoom();
		const initial = room.snapshot();
		expect(partyResponse('a', initial, null).state.deck).toEqual(initial.deck);
		const next = room.vote({
			playerId: 'a',
			roundId: initial.roundId!,
			itemId: initial.deck[0].id,
			liked: true
		});
		const response = partyResponse('a', next, initial.roundId);
		expect(response.state.deck).toBeUndefined();
		expect(restorePartyState(response.state, initial)).toEqual(next);
	});

	it('includes the reset and new deck across replay and rejects reuse across different rounds', () => {
		const room = makeRoom();
		const initial = room.snapshot();
		for (const playerId of ['a', 'b']) {
			room.vote({ playerId, roundId: initial.roundId!, itemId: initial.deck[0].id, liked: true });
		}
		const matched = room.snapshot();
		expect(restorePartyState(partyResponse('a', matched, initial.roundId).state, initial)).toEqual(
			matched
		);
		const lobby = room.playAgain({ playerId: 'a', roundId: initial.roundId! });
		expect(partyResponse('a', lobby, initial.roundId).state.deck).toEqual([]);
		const next = room.start({ playerId: 'a' });
		expect(partyResponse('a', next, initial.roundId).state.deck).toEqual(next.deck);
		expect(() =>
			restorePartyState(partyResponse('a', next, next.roundId).state, initial)
		).toThrow();
	});
});
