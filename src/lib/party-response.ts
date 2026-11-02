import type { PartyState } from '#lib/types.js';

export type PartyResponse = {
	playerId: string;
	state: Omit<PartyState, 'deck'> & { deck?: PartyState['deck'] };
};

export const partyResponse = (
	playerId: string,
	state: PartyState,
	knownRound: string | null
): PartyResponse => {
	if (state.roundId && state.roundId === knownRound) {
		return { playerId, state: { ...state, deck: undefined } };
	}
	return { playerId, state };
};

export const restorePartyState = (
	state: PartyResponse['state'],
	previous: PartyState | null
): PartyState => {
	if (state.deck) return { ...state, deck: state.deck };
	if (state.roundId && state.roundId === previous?.roundId) {
		return { ...state, deck: previous.deck };
	}
	throw new Error('The party deck is unavailable. Please reload the room.');
};
