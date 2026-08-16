import type {
	MediaItem,
	PartyState,
	PlayAgainPayload,
	PlayerActionPayload,
	PlayerView,
	VotePayload
} from '../types.ts';

type PlayerRecord = {
	id: string;
	name: string;
	avatar: number;
	connected: boolean;
	lastSeenAt: number;
};

type SourceMediaItem = Omit<MediaItem, 'id' | 'img' | 'imdbRating'> &
	Partial<Pick<MediaItem, 'img' | 'imdbRating'>> & { id?: string };

const requiredMediaFields = ['title', 'type', 'genres', 'year'] as const;
const allowedMediaFields = new Set<string>([...requiredMediaFields, 'img', 'imdbRating']);
const invalidMedia = (message: string) => new Error(`${message} Check the list and try again.`);

export type PersistedPartyEngine = {
	version: 1;
	items: MediaItem[];
	players: PlayerRecord[];
	participantIds: string[];
	positions: [string, number][];
	votes: [string, [string, boolean][]][];
	revision: number;
	roundId: string | null;
	phase: PartyState['phase'];
	deck: MediaItem[];
	match: MediaItem | null;
	message: string | null;
};

const safeName = (name: string) =>
	name
		.replace(/[^\p{L}\p{N}\s-]/gu, '')
		.trim()
		.slice(0, 24);

const avatarFromId = (id: string) => {
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return Math.abs(hash) % 6;
};

const makeId = (item: SourceMediaItem, index: number) =>
	item.id ??
	`${item.title}-${item.year}-${index}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

export class PartyEngine {
	private items: MediaItem[];
	private readonly random: () => number;
	private readonly players = new Map<string, PlayerRecord>();
	private participantIds: string[] = [];
	private positions = new Map<string, number>();
	private votes = new Map<string, Map<string, boolean>>();
	private revision = 0;
	private roundId: string | null = null;
	private phase: PartyState['phase'] = 'lobby';
	private deck: MediaItem[] = [];
	private match: MediaItem | null = null;
	private message: string | null = null;

	constructor(
		sourceItems: SourceMediaItem[],
		random: () => number = Math.random,
		allowGeneratedId = false
	) {
		this.random = random;
		this.items = this.normalizeMedia(sourceItems, allowGeneratedId);
	}

	static restore(state: PersistedPartyEngine, random: () => number = Math.random) {
		if (state?.version !== 1 || !Array.isArray(state.items)) {
			throw new Error('Unsupported persisted party state');
		}

		const engine = new PartyEngine(state.items, random, true);
		for (const player of state.players) engine.players.set(player.id, player);
		engine.participantIds = state.participantIds;
		engine.positions = new Map(state.positions);
		engine.votes = new Map(
			state.votes.map(([itemId, playerVotes]) => [itemId, new Map(playerVotes)])
		);
		engine.revision = state.revision;
		engine.roundId = state.roundId;
		engine.phase = state.phase;
		engine.deck = state.deck;
		engine.match = state.match;
		engine.message = state.message;
		return engine;
	}

	persist(): PersistedPartyEngine {
		return {
			version: 1,
			items: this.items,
			players: [...this.players.values()],
			participantIds: this.participantIds,
			positions: [...this.positions.entries()],
			votes: [...this.votes.entries()].map(([itemId, playerVotes]) => [
				itemId,
				[...playerVotes.entries()]
			]),
			revision: this.revision,
			roundId: this.roundId,
			phase: this.phase,
			deck: this.deck,
			match: this.match,
			message: this.message
		};
	}

	replaceMedia(sourceItems: SourceMediaItem[]) {
		if (this.phase !== 'lobby') return this.snapshot();
		this.items = this.normalizeMedia(sourceItems);
		this.message = null;
		this.touch();
		return this.snapshot();
	}

	setLobbyMessage(message: string) {
		if (this.phase !== 'lobby') return this.snapshot();
		this.message = message;
		this.touch();
		return this.snapshot();
	}

	private normalizeMedia(sourceItems: SourceMediaItem[], allowGeneratedId = false) {
		if (!Array.isArray(sourceItems) || sourceItems.length === 0) {
			throw invalidMedia('The list must contain at least one movie or series.');
		}

		const items = sourceItems.map((item, index) => {
			const label = `Item ${index + 1}`;
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				throw invalidMedia(`${label} must be a valid movie or series entry.`);
			}

			for (const field of requiredMediaFields) {
				if (!Object.hasOwn(item, field)) {
					throw invalidMedia(`${label} is missing required field "${field}".`);
				}
			}

			for (const field of Object.keys(item)) {
				if (!allowedMediaFields.has(field) && !(allowGeneratedId && field === 'id')) {
					throw invalidMedia(`${label} contains unsupported field "${field}".`);
				}
			}

			if (typeof item.title !== 'string' || item.title.trim().length === 0) {
				throw invalidMedia(`${label} field "title" must be a non-empty string.`);
			}
			if (item.type !== 'movie' && item.type !== 'series') {
				throw invalidMedia(`${label} field "type" must be either "movie" or "series".`);
			}
			if (!Array.isArray(item.genres) || item.genres.length === 0) {
				throw invalidMedia(`${label} field "genres" must be a non-empty array of strings.`);
			}
			for (const [genreIndex, genre] of item.genres.entries()) {
				if (typeof genre !== 'string' || genre.trim().length === 0) {
					throw invalidMedia(`${label} field "genres[${genreIndex}]" must be a non-empty string.`);
				}
			}
			if (item.img !== undefined && typeof item.img !== 'string') {
				throw invalidMedia(`${label} field "img" must be a string when provided.`);
			}
			if (
				typeof item.year !== 'number' ||
				!Number.isInteger(item.year) ||
				item.year < 1888 ||
				item.year > 2100
			) {
				throw invalidMedia(`${label} field "year" must be an integer from 1888 to 2100.`);
			}
			if (
				item.imdbRating !== undefined &&
				(typeof item.imdbRating !== 'number' ||
					!Number.isFinite(item.imdbRating) ||
					item.imdbRating < 0 ||
					item.imdbRating > 10)
			) {
				throw invalidMedia(`${label} field "imdbRating" must be a number from 0 to 10.`);
			}
			if (item.id !== undefined && (typeof item.id !== 'string' || item.id.trim().length === 0)) {
				throw invalidMedia(`${label} field "id" must be a non-empty string when provided.`);
			}

			return {
				...item,
				title: item.title.trim(),
				img: item.img?.trim() ?? '',
				imdbRating: item.imdbRating ?? 0,
				genres: item.genres.map((genre) => genre.trim()),
				id: makeId(item, index)
			};
		});

		const ids = new Set<string>();
		for (const [index, item] of items.entries()) {
			if (ids.has(item.id)) {
				throw invalidMedia(`Item ${index + 1} has a duplicate "id" value.`);
			}
			ids.add(item.id);
		}

		return items;
	}

	connect(playerId: string, requestedName: string, now = Date.now()) {
		if (!playerId) return this.snapshot();
		const existing = this.players.get(playerId);
		const name = safeName(requestedName) || existing?.name || `Guest ${this.players.size + 1}`;
		this.players.set(playerId, {
			id: playerId,
			name,
			avatar: existing?.avatar ?? avatarFromId(playerId),
			connected: true,
			lastSeenAt: now
		});
		if (!existing || !existing.connected || existing.name !== name) this.touch();
		return this.snapshot();
	}

	markDisconnected(playerId: string, now = Date.now()) {
		const player = this.players.get(playerId);
		if (!player || !player.connected) return this.snapshot();
		player.connected = false;
		player.lastSeenAt = now;
		this.touch();
		return this.snapshot();
	}

	pruneInactive(now = Date.now(), timeoutMs = 8_000) {
		for (const player of [...this.players.values()]) {
			if (now - player.lastSeenAt < timeoutMs) continue;
			if (player.connected) player.connected = false;
			this.removeDisconnected(player.id);
		}
		return this.snapshot();
	}

	removeDisconnected(playerId: string) {
		const player = this.players.get(playerId);
		if (!player || player.connected) return this.snapshot();
		this.players.delete(playerId);

		if (this.participantIds.includes(playerId)) {
			this.participantIds = this.participantIds.filter((id) => id !== playerId);
			this.positions.delete(playerId);
			for (const itemVotes of this.votes.values()) itemVotes.delete(playerId);

			if (this.phase === 'playing' && this.participantIds.length < 2) {
				this.reset('A player left, so the room returned to the lobby.');
				return this.snapshot();
			}
			if (this.phase === 'playing') this.resolveRound();
		}

		this.touch();
		return this.snapshot();
	}

	start({ playerId }: PlayerActionPayload) {
		if (this.phase !== 'lobby' || !this.players.get(playerId)?.connected) return this.snapshot();
		const connected = [...this.players.values()].filter((player) => player.connected);
		if (connected.length < 2) {
			this.message = 'At least two people are needed to start.';
			this.touch();
			return this.snapshot();
		}

		this.phase = 'playing';
		this.roundId = crypto.randomUUID();
		this.message = null;
		this.match = null;
		this.deck = this.shuffle(this.items);
		this.participantIds = connected.map((player) => player.id);
		this.positions = new Map(this.participantIds.map((id) => [id, 0]));
		this.votes = new Map(this.deck.map((item) => [item.id, new Map()]));
		this.touch();
		return this.snapshot();
	}

	vote({ playerId, roundId, itemId, liked }: VotePayload) {
		if (
			this.phase !== 'playing' ||
			this.roundId === null ||
			roundId !== this.roundId ||
			!this.participantIds.includes(playerId)
		) {
			return this.snapshot();
		}
		const position = this.positions.get(playerId) ?? 0;
		const current = this.deck[position];
		if (!current || current.id !== itemId || this.votes.get(itemId)?.has(playerId)) {
			return this.snapshot();
		}

		this.votes.get(itemId)?.set(playerId, liked);
		this.positions.set(playerId, position + 1);
		this.resolveRound();
		this.touch();
		return this.snapshot();
	}

	playAgain({ playerId, roundId }: PlayAgainPayload) {
		if (
			!this.players.get(playerId)?.connected ||
			(this.phase !== 'matched' && this.phase !== 'no-match') ||
			this.roundId !== roundId
		) {
			return this.snapshot();
		}
		this.reset(null);
		return this.snapshot();
	}

	snapshot(): PartyState {
		const visiblePlayers: PlayerView[] =
			this.phase === 'lobby'
				? [...this.players.values()]
						.filter((player) => player.connected)
						.map((player) => ({
							id: player.id,
							name: player.name,
							avatar: player.avatar,
							connected: player.connected,
							progress: 0,
							total: this.items.length
						}))
				: this.participantIds
						.map((id) => this.players.get(id))
						.filter((player): player is PlayerRecord => Boolean(player))
						.map((player) => ({
							id: player.id,
							name: player.name,
							avatar: player.avatar,
							connected: player.connected,
							progress: this.positions.get(player.id) ?? 0,
							total: this.deck.length
						}));

		return {
			revision: this.revision,
			roundId: this.roundId,
			phase: this.phase,
			onlineCount: [...this.players.values()].filter((player) => player.connected).length,
			players: visiblePlayers,
			deck: this.deck,
			match: this.match,
			message: this.message
		};
	}

	private resolveRound() {
		for (const item of this.deck) {
			const itemVotes = this.votes.get(item.id);
			if (
				itemVotes &&
				this.participantIds.length >= 2 &&
				this.participantIds.every((id) => itemVotes.get(id) === true)
			) {
				this.phase = 'matched';
				this.match = item;
				return;
			}
		}

		if (this.participantIds.every((id) => (this.positions.get(id) ?? 0) >= this.deck.length)) {
			this.phase = 'no-match';
		}
	}

	private reset(message: string | null) {
		this.phase = 'lobby';
		this.roundId = null;
		this.participantIds = [];
		this.positions = new Map();
		this.votes = new Map();
		this.deck = [];
		this.match = null;
		this.message = message;
		this.touch();
	}

	private shuffle(items: MediaItem[]) {
		const result = [...items];
		for (let index = result.length - 1; index > 0; index -= 1) {
			const swapWith = Math.floor(this.random() * (index + 1));
			[result[index], result[swapWith]] = [result[swapWith], result[index]];
		}
		return result;
	}

	private touch() {
		this.revision += 1;
	}
}
