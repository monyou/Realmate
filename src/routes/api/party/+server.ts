import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadMedia } from '$lib/server/media';
import { mutateParty, readParty } from '$lib/server/party-store';

const playerCookie = 'reelmate-player';
const noStore = { 'cache-control': 'no-store, max-age=0' };

type PartyAction =
	| { type: 'hello'; name?: unknown }
	| { type: 'start' }
	| { type: 'vote'; roundId?: unknown; itemId?: unknown; liked?: unknown }
	| { type: 'again'; roundId?: unknown }
	| { type: 'leave' };

const identity = (cookies: Parameters<RequestHandler>[0]['cookies'], secure: boolean) => {
	let playerId = cookies.get(playerCookie);
	if (!playerId || !/^[0-9a-f-]{36}$/i.test(playerId)) playerId = crypto.randomUUID();
	cookies.set(playerCookie, playerId, {
		httpOnly: true,
		sameSite: 'lax',
		secure,
		path: '/',
		maxAge: 60 * 60 * 24 * 365
	});
	return playerId;
};

const failure = (error: unknown) => {
	console.error('Party API request failed', error);
	const message = error instanceof Error ? error.message : 'The party room is unavailable.';
	return json({ message }, { status: 503, headers: noStore });
};

export const GET: RequestHandler = async ({ cookies, url }) => {
	try {
		const playerId = identity(cookies, url.protocol === 'https:');
		return json({ playerId, state: await readParty() }, { headers: noStore });
	} catch (error) {
		return failure(error);
	}
};

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	try {
		const action = (await request.json()) as PartyAction;
		const playerId = identity(cookies, url.protocol === 'https:');

		const state = await mutateParty(async (engine) => {
			engine.pruneInactive();

			switch (action?.type) {
				case 'hello':
					return engine.connect(playerId, typeof action.name === 'string' ? action.name : '');
				case 'start':
					if (engine.snapshot().phase !== 'lobby') return engine.snapshot();
					try {
						engine.replaceMedia(await loadMedia());
						return engine.start({ playerId });
					} catch (error) {
						console.error('Failed to refresh media from Vercel Blob', error);
						return engine.setLobbyMessage(
							'Could not refresh the media list. Please try starting again.'
						);
					}
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
