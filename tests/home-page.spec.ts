import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import HomePage from '../src/routes/+page.svelte';

const renderHome = (user: { email: string } | null) =>
	render(HomePage, {
		props: {
			data: { configured: true, roomId: '', user }
		}
	}).body;

describe('home page party joining', () => {
	it.each([
		[null, '/register'],
		[{ email: 'viewer@example.com' }, '/profile']
	] as const)('routes the host action to %s and offers code entry', (user, destination) => {
		const body = renderHome(user);
		expect(body).toMatch(
			new RegExp(`<a href="${destination}"[^>]*><span>Host a watch party</span>`)
		);
		expect(body).toContain('Join with a code');
		expect(body.includes('href="/login"')).toBe(user === null);
	});
});
