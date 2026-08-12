import type { Plugin, ViteDevServer, WebSocket, WebSocketClient } from 'vite';
import type { HelloPayload, PlayAgainPayload, PlayerActionPayload, VotePayload } from '../types.ts';
import { PartyEngine } from './party-engine.ts';

type SourceMedia = ConstructorParameters<typeof PartyEngine>[0];

const loadMedia = async (blobUrl: string): Promise<SourceMedia> => {
	const response = await fetch(blobUrl, {
		cache: 'no-store',
		headers: { accept: 'application/json' }
	});
	if (!response.ok) {
		throw new Error(
			`Unable to load media from Vercel Blob (${response.status} ${response.statusText})`
		);
	}

	const media: unknown = await response.json();
	if (!Array.isArray(media)) throw new Error('Vercel Blob media.json must contain a JSON array');
	return media as SourceMedia;
};

export const partyPlugin = (mediaBlobUrl: string): Plugin => {
	let engine: PartyEngine;
	const identities = new Map<WebSocket, string>();
	const socketsByPlayer = new Map<string, Set<WebSocket>>();
	const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();
	let startRound: Promise<void> | undefined;
	let server: ViteDevServer;

	const broadcast = () => server.ws.send('reel:state', engine.snapshot());

	const remember = (client: WebSocketClient, playerId: string) => {
		const socket = client.socket;
		const previous = identities.get(socket);
		if (previous && previous !== playerId) socketsByPlayer.get(previous)?.delete(socket);
		identities.set(socket, playerId);
		const sockets = socketsByPlayer.get(playerId) ?? new Set<WebSocket>();
		sockets.add(socket);
		socketsByPlayer.set(playerId, sockets);
		const timer = removalTimers.get(playerId);
		if (timer) clearTimeout(timer);
		removalTimers.delete(playerId);
	};

	const forget = (socket: WebSocket) => {
		const playerId = identities.get(socket);
		if (!playerId) return;
		identities.delete(socket);
		const sockets = socketsByPlayer.get(playerId);
		sockets?.delete(socket);
		if (sockets?.size) return;

		socketsByPlayer.delete(playerId);
		engine.markDisconnected(playerId);
		broadcast();
		const timer = setTimeout(() => {
			engine.removeDisconnected(playerId);
			removalTimers.delete(playerId);
			broadcast();
		}, 8_000);
		removalTimers.set(playerId, timer);
	};

	return {
		name: 'reelmate-live-room',
		apply: (_config, environment) => environment.command === 'serve' && environment.mode !== 'test',
		async configureServer(viteServer) {
			engine = new PartyEngine(await loadMedia(mediaBlobUrl));
			server = viteServer;
			server.ws.on('connection', (socket) => socket.once('close', () => forget(socket)));

			server.ws.on('reel:hello', (payload: HelloPayload, client) => {
				if (!payload?.playerId) return;
				remember(client, payload.playerId);
				engine.connect(payload.playerId, payload.name);
				broadcast();
			});

			server.ws.on('reel:start', async (payload: PlayerActionPayload, client) => {
				if (identities.get(client.socket) !== payload?.playerId) return;
				if (engine.snapshot().phase !== 'lobby' || startRound) return;

				startRound = (async () => {
					try {
						engine.replaceMedia(await loadMedia(mediaBlobUrl));
						engine.start(payload);
					} catch (error) {
						console.error('Failed to refresh media from Vercel Blob', error);
						engine.setLobbyMessage('Could not refresh the media list. Please try starting again.');
					}
					broadcast();
				})();

				try {
					await startRound;
				} finally {
					startRound = undefined;
				}
			});

			server.ws.on('reel:vote', (payload: VotePayload, client) => {
				if (identities.get(client.socket) !== payload?.playerId) return;
				engine.vote(payload);
				broadcast();
			});

			server.ws.on('reel:again', (payload: PlayAgainPayload, client) => {
				if (identities.get(client.socket) !== payload?.playerId) return;
				engine.playAgain(payload);
				broadcast();
			});
		}
	};
};
