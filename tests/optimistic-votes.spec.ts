import { describe, expect, it } from 'vitest';
import { optimisticPlayerProgress, voteWasAcknowledged } from '../src/lib/optimistic-votes';
import type { PartyState } from '../src/lib/types';

const state = (progress: number, phase: PartyState['phase'] = 'playing'): PartyState => ({
	revision: progress,
	roundId: 'round-1',
	phase,
	onlineCount: 2,
	players: [{ id: 'player-1', name: 'One', avatar: 0, connected: true, progress, total: 3 }],
	deck: [],
	match: null,
	message: null
});

describe('optimistic vote progress', () => {
	it('advances through queued votes without double-counting server confirmations', () => {
		const votes = [
			{ roundId: 'round-1', itemId: 'one', liked: true, position: 0 },
			{ roundId: 'round-1', itemId: 'two', liked: false, position: 1 }
		];

		expect(optimisticPlayerProgress(state(0), 'player-1', votes)).toBe(2);
		expect(optimisticPlayerProgress(state(1), 'player-1', votes)).toBe(2);
		expect(optimisticPlayerProgress(state(2), 'player-1', votes)).toBe(2);
	});

	it('ignores queued votes from another round', () => {
		expect(
			optimisticPlayerProgress(state(1), 'player-1', [
				{ roundId: 'old-round', itemId: 'one', liked: true, position: 2 }
			])
		).toBe(1);
	});

	it('requires the server to advance past the queued card', () => {
		const vote = { roundId: 'round-1', itemId: 'one', liked: true, position: 0 };

		expect(voteWasAcknowledged(state(0), 'player-1', vote)).toBe(false);
		expect(voteWasAcknowledged(state(1), 'player-1', vote)).toBe(true);
		expect(voteWasAcknowledged(state(0, 'matched'), 'player-1', vote)).toBe(true);
	});
});
