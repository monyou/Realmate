import { env } from '$env/dynamic/private';
import type { PartyState } from '$lib/types';
import { Redis } from '@upstash/redis';
import { loadMedia } from './media';
import { PartyEngine, type PersistedPartyEngine } from './party-engine';

type PartyOperation = (engine: PartyEngine) => PartyState | Promise<PartyState>;

const lockTimeoutMs = 12_000;
const lockWaitAttempts = 80;

let redis: Redis | undefined;

const roomKey = () => env.REALMATE_ROOM_KEY || `realmate:party:${env.VERCEL_ENV || 'development'}`;

const getRedis = () => {
	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) {
		throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
	}

	redis ??= new Redis({ url, token });
	return redis;
};

const makeEngine = async (stored?: PersistedPartyEngine | null) => {
	if (stored) {
		try {
			return PartyEngine.restore(stored);
		} catch (error) {
			console.error('Ignoring incompatible persisted party state', error);
		}
	}
	return new PartyEngine(await loadMedia());
};

const releaseLock = async (client: Redis, key: string, token: string) => {
	await client.eval(
		"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
		[key],
		[token]
	);
};

const withRedisParty = async (operation: PartyOperation) => {
	const client = getRedis();
	const key = roomKey();
	const lockKey = `${key}:lock`;
	const lockToken = crypto.randomUUID();

	for (let attempt = 0; attempt < lockWaitAttempts; attempt += 1) {
		const acquired = await client.set(lockKey, lockToken, { nx: true, px: lockTimeoutMs });
		if (acquired === 'OK') {
			try {
				const stored = await client.get<PersistedPartyEngine>(key);
				const engine = await makeEngine(stored);
				const state = await operation(engine);
				await client.set(key, engine.persist());
				return state;
			} finally {
				await releaseLock(client, lockKey, lockToken);
			}
		}
		await new Promise((resolve) => setTimeout(resolve, Math.min(25 + attempt * 5, 100)));
	}

	throw new Error('The party room is busy. Please try again.');
};

export const mutateParty = withRedisParty;

export const readParty = async () => {
	const client = getRedis();
	const stored = await client.get<PersistedPartyEngine>(roomKey());
	if (stored) return PartyEngine.restore(stored).snapshot();
	return withRedisParty((engine) => engine.snapshot());
};
