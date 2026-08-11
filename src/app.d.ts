import 'vite/types/customEvent.d.ts';
import type {
	HelloPayload,
	PartyState,
	PlayAgainPayload,
	PlayerActionPayload,
	VotePayload
} from '$lib/types';

declare module 'vite/types/customEvent.d.ts' {
	interface CustomEventMap {
		'reel:hello': HelloPayload;
		'reel:start': PlayerActionPayload;
		'reel:vote': VotePayload;
		'reel:again': PlayAgainPayload;
		'reel:state': PartyState;
	}
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
