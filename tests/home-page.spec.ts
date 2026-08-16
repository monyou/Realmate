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
	it('shows Join party after the guest authentication actions', () => {
		const body = renderHome(null);

		expect(body).toContain('Log in');
		expect(body).toContain('Create account');
		expect(body.indexOf('Join party')).toBeGreaterThan(body.indexOf('Create account'));
	});

	it('shows Join party after Open your lists for authenticated users', () => {
		const body = renderHome({ email: 'viewer@example.com' });

		expect(body).toContain('Open your lists');
		expect(body.indexOf('Join party')).toBeGreaterThan(body.indexOf('Open your lists'));
	});
});
