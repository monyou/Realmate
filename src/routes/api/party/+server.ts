import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadMedia, maxMediaBytes, type SourceMedia } from '$lib/server/media';
import { PartyEngine } from '$lib/server/party-engine';
import { createParty, mutateParty, PartyNotFoundError, readParty } from '$lib/server/party-store';

const playerCookie = 'reelmate-player';
const noStore = { 'cache-control': 'no-store, max-age=0' };

type PartyAction =
	| { type: 'create'; name?: unknown; mediaUrl?: unknown; media?: unknown }
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
		const playerId = identity(cookies, url.protocol === 'https:');
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
		const playerId = identity(cookies, url.protocol === 'https:');

		if (action?.type === 'create') {
			if (typeof action.name !== 'string') {
				return json(
					{ message: 'A movie-list link or JSON file is required.' },
					{ status: 400, headers: noStore }
				);
			}

			let items: SourceMedia;
			try {
				if (typeof action.mediaUrl === 'string' && action.mediaUrl.trim()) {
					items = await loadMedia(action.mediaUrl.trim());
				} else if (Array.isArray(action.media)) {
					if (new TextEncoder().encode(JSON.stringify(action.media)).byteLength > maxMediaBytes) {
						throw new Error('The movie list is too large. The maximum size is 2 MB.');
					}
					items = action.media as SourceMedia;
				} else {
					throw new Error('Provide a public JSON link or upload a JSON file.');
				}
				new PartyEngine(items);
			} catch (error) {
				const message = error instanceof Error ? error.message : 'The movie list is invalid.';
				return json({ message }, { status: 400, headers: noStore });
			}

			const created = await createParty(items, playerId, action.name);
			return json({ playerId, ...created }, { status: 201, headers: noStore });
		}

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
