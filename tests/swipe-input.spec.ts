import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const swipeDeck = readFileSync(
	resolve(import.meta.dirname, '../src/lib/components/party/SwipeDeck.svelte'),
	'utf8'
);
const partyClient = readFileSync(
	resolve(import.meta.dirname, '../src/lib/party-client.ts'),
	'utf8'
);
const homePage = readFileSync(resolve(import.meta.dirname, '../src/routes/+page.svelte'), 'utf8');

describe('swipe card mobile input', () => {
	it('supports Touch Events without depending on pointer capture in installed mobile apps', () => {
		expect(swipeDeck).toContain("if (event.pointerType === 'touch') return;");
		expect(swipeDeck).toContain("node.addEventListener('touchstart', touchStart, nonPassive)");
		expect(swipeDeck).toContain("node.addEventListener('touchmove', touchMove, nonPassive)");
		expect(swipeDeck).toContain("node.addEventListener('touchend', touchEnd)");
		expect(swipeDeck).toContain("node.addEventListener('touchcancel', touchCancel)");
		expect(swipeDeck).toContain('use:mobileSwipe');
	});

	it('keeps touch-action disabled on the draggable card', () => {
		expect(swipeDeck).toMatch(/class="[^"]*touch-none[^"]*"/);
	});

	it('isolates both card faces during the plot flip', () => {
		expect(swipeDeck.match(/-webkit-backface-visibility: hidden/g)).toHaveLength(2);
		expect(swipeDeck).toContain('-webkit-transform: translateZ(0.1px)');
		expect(swipeDeck).toContain('-webkit-transform: rotateY(180deg) translateZ(0.1px)');
	});

	it('advances optimistically and sends queued votes in the background', () => {
		expect(homePage).toContain(
			'pendingVotes = [...pendingVotes, { roundId, itemId, liked, position }]'
		);
		expect(homePage).toContain('void flushVoteQueue()');
		expect(partyClient).toContain("keepalive: action?.type === 'vote'");
	});
});
