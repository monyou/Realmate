import { describe, expect, it } from 'vitest';
import { roomTtlSeconds } from './party-store';

describe('roomTtlSeconds', () => {
	it('keeps active rooms for 24 hours after their last heartbeat', () => {
		expect(roomTtlSeconds('lobby')).toBe(24 * 60 * 60);
		expect(roomTtlSeconds('playing')).toBe(24 * 60 * 60);
	});

	it('cleans up completed rooms two hours after their last heartbeat', () => {
		expect(roomTtlSeconds('matched')).toBe(2 * 60 * 60);
		expect(roomTtlSeconds('no-match')).toBe(2 * 60 * 60);
	});
});
