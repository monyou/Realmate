import type { PartyState } from '$lib/types';

export type QueuedVote = {
	roundId: string;
	itemId: string;
	liked: boolean;
	position: number;
};

export const optimisticPlayerProgress = (
	state: PartyState | null,
	playerId: string,
	queuedVotes: QueuedVote[]
) => {
	const confirmed = state?.players.find((player) => player.id === playerId)?.progress ?? 0;
	if (state?.phase !== 'playing' || !state.roundId) return confirmed;

	return queuedVotes.reduce(
		(progress, vote) =>
			vote.roundId === state.roundId ? Math.max(progress, vote.position + 1) : progress,
		confirmed
	);
};

export const voteWasAcknowledged = (state: PartyState, playerId: string, vote: QueuedVote) => {
	if (state.roundId !== vote.roundId || state.phase !== 'playing') return true;
	const confirmed = state.players.find((player) => player.id === playerId)?.progress ?? 0;
	return confirmed > vote.position;
};
