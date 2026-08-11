import type { Plugin, ViteDevServer, WebSocket, WebSocketClient } from 'vite';
import media from '../data/media.json' with { type: 'json' };
import type { HelloPayload, PlayAgainPayload, PlayerActionPayload, VotePayload } from '../types.ts';
import { PartyEngine } from './party-engine.ts';

export const partyPlugin = (): Plugin => {
	const engine = new PartyEngine(media as never);
	const identities = new Map<WebSocket, string>();
	const socketsByPlayer = new Map<string, Set<WebSocket>>();
	const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();
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
		apply: 'serve',
		configureServer(viteServer) {
			server = viteServer;
			server.ws.on('connection', (socket) => socket.once('close', () => forget(socket)));

			server.ws.on('reel:hello', (payload: HelloPayload, client) => {
				if (!payload?.playerId) return;
				remember(client, payload.playerId);
				engine.connect(payload.playerId, payload.name);
				broadcast();
			});

			server.ws.on('reel:start', (payload: PlayerActionPayload, client) => {
				if (identities.get(client.socket) !== payload?.playerId) return;
				engine.start(payload);
				broadcast();
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
