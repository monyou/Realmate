import { describe, expect, it } from 'vitest';
import { normalizeRoomCode, partyRoomPath } from '$lib/party-room';

describe('party room codes', () => {
	it('normalizes copied room codes', () => {
		expect(normalizeRoomCode('  ABCDEF0123456789ABCDEF0123456789  ')).toBe(
			'abcdef0123456789abcdef0123456789'
		);
		expect(normalizeRoomCode('550e8400-e29b-41d4-a716-446655440000')).toBe(
			'550e8400e29b41d4a716446655440000'
		);
	});

	it('builds the internal party route without exposing a full URL', () => {
		expect(partyRoomPath('/', '550e8400e29b41d4a716446655440000')).toBe(
			'/?room=550e8400e29b41d4a716446655440000'
		);
	});

	it('keeps invalid non-empty codes so the room page can show its not-found state', () => {
		expect(partyRoomPath('/', 'not a room')).toBe('/?room=not%20a%20room');
	});
});
