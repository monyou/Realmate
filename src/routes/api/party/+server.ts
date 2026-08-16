import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mutateParty, PartyNotFoundError, readParty } from '$lib/server/party-store';
import { getPlayerIdentity } from '$lib/server/player-identity';

const noStore = { 'cache-control': 'no-store, max-age=0' };

type PartyAction =
	| { type: 'hello'; name?: unknown }
	| { type: 'start' }
	| { type: 'vote'; roundId?: unknown; itemId?: unknown; liked?: unknown }
	| { type: 'again'; roundId?: unknown }
	| { type: 'leave' };

const failure = (error: unknown) => {
	if (error instanceof PartyNotFoundError) {
		return json({ message: error.message }, { status: 404, headers: noStore });
	}
	console.error('Party API request failed', error);
	return json(
		{ message: 'The party room is unavailable. Please try again.' },
		{ status: 503, headers: noStore }
	);
};

export const GET: RequestHandler = async ({ cookies, url }) => {
	try {
		const playerId = getPlayerIdentity(cookies, url.protocol === 'https:');
		return json(
			{ playerId, state: await readParty(url.searchParams.get('room') ?? '') },
			{ headers: noStore }
		);
	} catch (error) {
		return failure(error);
	}
};

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const action = (await request.json()) as PartyAction;
		const playerId = getPlayerIdentity(cookies, url.protocol === 'https:');

		const roomId = url.searchParams.get('room') ?? '';
		const state = await mutateParty(roomId, async (engine) => {
			engine.pruneInactive();

			switch (action?.type) {
				case 'hello':
					return engine.connect(playerId, typeof action.name === 'string' ? action.name : '');
				case 'start':
					return engine.start({ playerId });
				case 'vote':
					if (
						typeof action.roundId !== 'string' ||
						typeof action.itemId !== 'string' ||
						typeof action.liked !== 'boolean'
					) {
						return engine.snapshot();
					}
					return engine.vote({
						playerId,
						roundId: action.roundId,
						itemId: action.itemId,
						liked: action.liked
					});
				case 'again':
					if (typeof action.roundId !== 'string') return engine.snapshot();
					return engine.playAgain({ playerId, roundId: action.roundId });
				case 'leave':
					return engine.markDisconnected(playerId);
				default:
					return engine.snapshot();
			}
		});

		return json({ playerId, state }, { headers: noStore });
	} catch (error) {
		return failure(error);
	}
};
