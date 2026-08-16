export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			movie_lists: {
				Row: {
					created_at: string;
					description: string;
					id: string;
					items: Json;
					name: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					description?: string;
					id?: string;
					items: Json;
					name: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					description?: string;
					id?: string;
					items?: Json;
					name?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};

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
