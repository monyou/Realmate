export type MediaKind = 'movie' | 'series';

export type MediaItem = {
	id: string;
	title: string;
	type: MediaKind;
	genres: string[];
	img: string;
	year: number;
	imdbRating: number;
};

export type SourceMedia = Omit<MediaItem, 'id'>[];

export type PlayerView = {
	id: string;
	name: string;
	avatar: number;
	connected: boolean;
	progress: number;
	total: number;
};

export type PartyPhase = 'lobby' | 'playing' | 'matched' | 'no-match';

export type PartyState = {
	revision: number;
	roundId: string | null;
	phase: PartyPhase;
	onlineCount: number;
	players: PlayerView[];
	deck: MediaItem[];
	match: MediaItem | null;
	message: string | null;
};

export type HelloPayload = { playerId: string; name: string };
export type VotePayload = { playerId: string; roundId: string; itemId: string; liked: boolean };
export type PlayerActionPayload = { playerId: string };
export type PlayAgainPayload = { playerId: string; roundId: string };
