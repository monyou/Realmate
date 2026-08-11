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
};

type SourceMediaItem = Omit<MediaItem, 'id'> & { id?: string };

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
	private readonly items: MediaItem[];
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

	constructor(sourceItems: SourceMediaItem[], random: () => number = Math.random) {
		this.random = random;
		this.items = sourceItems
			.filter(
				(item) =>
					item &&
					typeof item.title === 'string' &&
					(item.type === 'movie' || item.type === 'series') &&
					Array.isArray(item.genres) &&
					item.genres.length > 0 &&
					item.genres.every((genre) => typeof genre === 'string' && genre.trim().length > 0) &&
					typeof item.img === 'string' &&
					Number.isFinite(item.year) &&
					Number.isFinite(item.imdbRating) &&
					item.imdbRating >= 0 &&
					item.imdbRating <= 10
			)
			.map((item, index) => ({
				...item,
				genres: item.genres.map((genre) => genre.trim()),
				id: makeId(item, index)
			}));

		if (this.items.length === 0) {
			throw new Error('media.json must contain at least one valid movie or series');
		}
	}

	connect(playerId: string, requestedName: string) {
		if (!playerId) return this.snapshot();
		const existing = this.players.get(playerId);
		const name = safeName(requestedName) || `Guest ${this.players.size + 1}`;
		this.players.set(playerId, {
			id: playerId,
			name,
			avatar: existing?.avatar ?? avatarFromId(playerId),
			connected: true
		});
		this.touch();
		return this.snapshot();
	}

	markDisconnected(playerId: string) {
		const player = this.players.get(playerId);
		if (!player) return this.snapshot();
		player.connected = false;
		this.touch();
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
						.map((player) => ({ ...player, progress: 0, total: this.items.length }))
				: this.participantIds
						.map((id) => this.players.get(id))
						.filter((player): player is PlayerRecord => Boolean(player))
						.map((player) => ({
							...player,
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
