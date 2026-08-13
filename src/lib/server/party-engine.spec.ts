import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../types';
import { PartyEngine } from './party-engine';

const items: Omit<MediaItem, 'id'>[] = [
	{
		title: 'First',
		type: 'movie',
		genres: ['Drama', 'Mystery'],
		img: '/first.jpg',
		year: 2025,
		imdbRating: 7.4
	},
	{
		title: 'Second',
		type: 'series',
		genres: ['Sci-Fi'],
		img: '/second.jpg',
		year: 2024,
		imdbRating: 8.2
	}
];

const joinTwoAndStart = () => {
	const room = new PartyEngine(items, () => 0.99);
	room.connect('a', 'A');
	room.connect('b', 'B');
	room.start({ playerId: 'a' });
	return room;
};

const vote = (
	room: PartyEngine,
	playerId: string,
	itemId: string,
	liked: boolean,
	roundId = room.snapshot().roundId
) => {
	if (!roundId) throw new Error('Expected an active round');
	return room.vote({ playerId, roundId, itemId, liked });
};

const playAgain = (room: PartyEngine, playerId: string) => {
	const roundId = room.snapshot().roundId;
	if (!roundId) throw new Error('Expected a completed round');
	return room.playAgain({ playerId, roundId });
};

describe('PartyEngine', () => {
	it('rejects an empty media array', () => {
		expect(() => new PartyEngine([])).toThrow('non-empty array');
	});

	it('rejects the entire file when any item is missing a required field', () => {
		expect(
			() =>
				new PartyEngine([
					items[0],
					{
						title: 'Broken',
						type: 'movie',
						genres: ['Drama'],
						img: '/broken.jpg',
						year: 2026
					}
				] as Omit<MediaItem, 'id'>[])
		).toThrow('Item 2 is missing required field "imdbRating"');
	});

	it.each([
		['title', { ...items[0], title: 42 }, 'must be a non-empty string'],
		['type', { ...items[0], type: 'documentary' }, 'must be either "movie" or "series"'],
		['genres', { ...items[0], genres: 'Drama' }, 'must be a non-empty array of strings'],
		[
			'genres entry',
			{ ...items[0], genres: ['Drama', 7] },
			'genres[1]" must be a non-empty string'
		],
		['img', { ...items[0], img: null }, 'must be a non-empty string'],
		['year', { ...items[0], year: '2026' }, 'must be an integer'],
		['imdbRating', { ...items[0], imdbRating: 11 }, 'must be a number from 0 to 10']
	])('rejects an invalid %s field', (_field, item, expected) => {
		expect(() => new PartyEngine([item] as Omit<MediaItem, 'id'>[])).toThrow(expected);
	});

	it('rejects unsupported fields to enforce the documented object shape', () => {
		expect(
			() =>
				new PartyEngine([
					{ ...items[0], description: 'This field is not part of the media schema.' }
				] as unknown as Omit<MediaItem, 'id'>[])
		).toThrow('unsupported field "description"');
	});

	it('requires two connected people to start', () => {
		const room = new PartyEngine(items);
		room.connect('a', 'A');
		expect(room.start({ playerId: 'a' }).phase).toBe('lobby');
		expect(room.snapshot().message).toContain('two');
	});

	it('refreshes media in the lobby without changing an active round', () => {
		const room = new PartyEngine(items, () => 0.99);
		room.connect('a', 'A');
		room.connect('b', 'B');
		room.replaceMedia([
			{
				title: 'Blob title',
				type: 'movie',
				genres: ['Drama'],
				img: '/blob.jpg',
				year: 2026,
				imdbRating: 8.5
			}
		]);

		const round = room.start({ playerId: 'a' });
		expect(round.deck.map((item) => item.title)).toEqual(['Blob title']);

		room.replaceMedia(items);
		expect(room.snapshot().deck.map((item) => item.title)).toEqual(['Blob title']);
	});

	it('restores an active round from durable state', () => {
		const room = joinTwoAndStart();
		const [first] = room.snapshot().deck;
		vote(room, 'a', first.id, true);

		const restored = PartyEngine.restore(room.persist());
		expect(restored.snapshot()).toEqual(room.snapshot());
		vote(restored, 'b', first.id, true);
		expect(restored.snapshot().phase).toBe('matched');
	});

	it('removes players whose heartbeat has expired', () => {
		const room = new PartyEngine(items);
		room.connect('a', 'A', 1_000);
		room.connect('b', 'B', 1_000);
		room.start({ playerId: 'a' });

		const state = room.pruneInactive(9_001, 8_000);
		expect(state).toMatchObject({ phase: 'lobby', onlineCount: 0 });
		expect(state.players).toEqual([]);
	});

	it('stops immediately when everyone likes the same title', () => {
		const room = joinTwoAndStart();
		const [first] = room.snapshot().deck;
		vote(room, 'a', first.id, true);
		expect(vote(room, 'b', first.id, true).phase).toBe('matched');
		expect(room.snapshot().match?.id).toBe(first.id);
	});

	it('waits for everyone to finish before declaring no match', () => {
		const room = joinTwoAndStart();
		const [first, second] = room.snapshot().deck;
		vote(room, 'a', first.id, true);
		vote(room, 'a', second.id, false);
		vote(room, 'b', first.id, false);
		expect(room.snapshot().phase).toBe('playing');
		vote(room, 'b', second.id, true);
		expect(room.snapshot().phase).toBe('no-match');
	});

	it('ignores a vote for anything except that player current card', () => {
		const room = joinTwoAndStart();
		const [, second] = room.snapshot().deck;
		vote(room, 'a', second.id, true);
		expect(room.snapshot().players.find((player) => player.id === 'a')?.progress).toBe(0);
	});

	it('clears every choice after a no-match and rejects delayed votes from the old round', () => {
		const room = joinTwoAndStart();
		const firstRoundId = room.snapshot().roundId;
		const [first, second] = room.snapshot().deck;

		vote(room, 'a', first.id, true);
		vote(room, 'a', second.id, false);
		vote(room, 'b', first.id, false);
		vote(room, 'b', second.id, true);
		expect(room.snapshot().phase).toBe('no-match');

		const reset = playAgain(room, 'a');
		expect(reset).toMatchObject({ phase: 'lobby', roundId: null, deck: [], match: null });
		expect(reset.players.every((player) => player.progress === 0)).toBe(true);

		const nextRound = room.start({ playerId: 'b' });
		expect(nextRound.roundId).not.toBe(firstRoundId);
		expect(nextRound.players.every((player) => player.progress === 0)).toBe(true);

		const [nextFirst] = nextRound.deck;
		if (!firstRoundId) throw new Error('Expected the first round ID');
		vote(room, 'a', nextFirst.id, true, firstRoundId);
		vote(room, 'b', nextFirst.id, true, firstRoundId);
		expect(room.snapshot().phase).toBe('playing');
		expect(room.snapshot().players.every((player) => player.progress === 0)).toBe(true);
	});

	it('clears a successful match before another round starts', () => {
		const room = joinTwoAndStart();
		const firstRoundId = room.snapshot().roundId;
		const [first] = room.snapshot().deck;
		vote(room, 'a', first.id, true);
		vote(room, 'b', first.id, true);
		expect(room.snapshot().phase).toBe('matched');

		playAgain(room, 'b');
		const nextRound = room.start({ playerId: 'a' });
		expect(nextRound).toMatchObject({ phase: 'playing', match: null });
		expect(nextRound.roundId).not.toBe(firstRoundId);
		expect(nextRound.players.every((player) => player.progress === 0)).toBe(true);

		if (!firstRoundId) throw new Error('Expected the completed round ID');
		const afterDelayedReplay = room.playAgain({ playerId: 'b', roundId: firstRoundId });
		expect(afterDelayedReplay.phase).toBe('playing');
		expect(afterDelayedReplay.roundId).toBe(nextRound.roundId);
	});
});
