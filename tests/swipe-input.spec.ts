import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const homePage = readFileSync(resolve(import.meta.dirname, '../src/routes/+page.svelte'), 'utf8');

describe('swipe card mobile input', () => {
	it('supports Touch Events without depending on pointer capture in installed mobile apps', () => {
		expect(homePage).toContain("if (event.pointerType === 'touch') return;");
		expect(homePage).toContain("node.addEventListener('touchstart', touchStart, nonPassive)");
		expect(homePage).toContain("node.addEventListener('touchmove', touchMove, nonPassive)");
		expect(homePage).toContain("node.addEventListener('touchend', touchEnd)");
		expect(homePage).toContain("node.addEventListener('touchcancel', touchCancel)");
		expect(homePage).toContain('use:mobileSwipe');
	});

	it('keeps touch-action disabled on the draggable card', () => {
		expect(homePage).toMatch(/class="[^"]*touch-none[^"]*"/);
	});
});
