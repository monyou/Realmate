import { partyResponse } from '#lib/party-response.js';
import type { RequestHandler } from './$types';
import { mutateParty, PartyNotFoundError, readParty } from '#lib/server/party-store.js';
import { getPlayerIdentity } from '#lib/server/player-identity.js';

const noStore = { 'cache-control': 'no-store, max-age=0' };

type PartyAction =
	| { type: 'hello'; name?: unknown }
	| { type: 'start' }
	| { type: 'vote'; roundId: string; itemId: string; liked: boolean }
	| { type: 'again'; roundId: string }
	| { type: 'leave' };

const isPartyAction = (value: unknown): value is PartyAction => {
	if (!value || typeof value !== 'object' || !('type' in value)) return false;
	switch (value.type) {
		case 'hello':
		case 'start':
		case 'leave':
			return true;
		case 'vote':
			return (
				'roundId' in value &&
				typeof value.roundId === 'string' &&
				'itemId' in value &&
				typeof value.itemId === 'string' &&
				'liked' in value &&
				typeof value.liked === 'boolean'
			);
		case 'again':
			return 'roundId' in value && typeof value.roundId === 'string';
		default:
			return false;
	}
};

const failure = (error: unknown) => {
	if (error instanceof PartyNotFoundError) {
		return Response.json({ message: error.message }, { status: 404, headers: noStore });
	}
	console.error('Party API request failed', error);
	return Response.json(
		{ message: 'The party room is unavailable. Please try again.' },
		{ status: 503, headers: noStore }
	);
};

export const GET: RequestHandler = async ({ cookies, url }) => {
	try {
		const playerId = getPlayerIdentity(cookies, url.protocol === 'https:');
		return Response.json(
			partyResponse(
				playerId,
				await readParty(url.searchParams.get('room') ?? ''),
				url.searchParams.get('knownRound')
			),
			{ headers: noStore }
		);
	} catch (error) {
		return failure(error);
	}
};

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	let action: unknown;
	try {
		action = await request.json();
	} catch {
		return Response.json(
			{ message: 'The party request could not be read.' },
			{ status: 400, headers: noStore }
		);
	}
	if (!isPartyAction(action)) {
		return Response.json(
			{ message: 'The party action is invalid.' },
			{ status: 400, headers: noStore }
		);
	}

	try {
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
					return engine.vote({
						playerId,
						roundId: action.roundId,
						itemId: action.itemId,
						liked: action.liked
					});
				case 'again':
					return engine.playAgain({ playerId, roundId: action.roundId });
				case 'leave':
					return engine.markDisconnected(playerId);
			}
		});

		return Response.json(partyResponse(playerId, state, url.searchParams.get('knownRound')), {
			headers: noStore
		});
	} catch (error) {
		return failure(error);
	}
};
