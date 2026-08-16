import { env } from '$env/dynamic/private';
import type { PartyState, SourceMedia } from '$lib/types';
import { Redis } from '@upstash/redis';
import { PartyEngine, type PersistedPartyEngine } from './party-engine';

type PartyOperation = (engine: PartyEngine) => PartyState | Promise<PartyState>;

const lockTimeoutMs = 12_000;
const lockWaitAttempts = 80;
const roomIdPattern = /^[0-9a-f]{32}$/;
const activeRoomTtlSeconds = 24 * 60 * 60;
const completedRoomTtlSeconds = 2 * 60 * 60;

let redis: Redis | undefined;

const roomKey = (roomId: string) => roomId;

export const roomTtlSeconds = (phase: PartyState['phase']) =>
	phase === 'matched' || phase === 'no-match' ? completedRoomTtlSeconds : activeRoomTtlSeconds;

export class PartyNotFoundError extends Error {
	constructor() {
		super('This watch party does not exist or is no longer available.');
		this.name = 'PartyNotFoundError';
	}
}

export const isRoomId = (value: string | null | undefined): value is string =>
	typeof value === 'string' && roomIdPattern.test(value);

const getRedis = () => {
	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) {
		throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
	}

	redis ??= new Redis({ url, token });
	return redis;
};

const releaseLock = async (client: Redis, key: string, token: string) => {
	await client.eval(
		"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
		[key],
		[token]
	);
};

export const createParty = async (items: SourceMedia, playerId: string, playerName: string) => {
	const client = getRedis();

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const roomId = crypto.randomUUID().replaceAll('-', '');
		const engine = new PartyEngine(items);
		const state = engine.connect(playerId, playerName);
		const created = await client.set(roomKey(roomId), engine.persist(), {
			nx: true,
			ex: roomTtlSeconds(state.phase)
		});
		if (created === 'OK') return { roomId, state };
	}

	throw new Error('Could not create a unique watch party. Please try again.');
};

export const mutateParty = async (roomId: string, operation: PartyOperation) => {
	if (!isRoomId(roomId)) throw new PartyNotFoundError();

	const client = getRedis();
	const key = roomKey(roomId);
	const lockKey = `${key}:lock`;
	const lockToken = crypto.randomUUID();

	for (let attempt = 0; attempt < lockWaitAttempts; attempt += 1) {
		const acquired = await client.set(lockKey, lockToken, { nx: true, px: lockTimeoutMs });
		if (acquired === 'OK') {
			try {
				const stored = await client.get<PersistedPartyEngine>(key);
				if (!stored) throw new PartyNotFoundError();
				const engine = PartyEngine.restore(stored);
				const state = await operation(engine);
				await client.set(key, engine.persist(), { ex: roomTtlSeconds(state.phase) });
				return state;
			} finally {
				await releaseLock(client, lockKey, lockToken);
			}
		}
		await new Promise((resolve) => setTimeout(resolve, Math.min(25 + attempt * 5, 100)));
	}

	throw new Error('The party room is busy. Please try again.');
};

export const readParty = async (roomId: string) => {
	if (!isRoomId(roomId)) throw new PartyNotFoundError();
	const stored = await getRedis().get<PersistedPartyEngine>(roomKey(roomId));
	if (!stored) throw new PartyNotFoundError();
	return PartyEngine.restore(stored).snapshot();
};
