import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ProfilePage from '../src/routes/profile/+page.svelte';

describe('profile list table', () => {
	it('uses the same desktop grid for headers and records', () => {
		const { body } = render(ProfilePage, {
			props: {
				data: {
					user: { email: 'viewer@example.com' },
					lists: [
						{
							id: '09d4779e-236d-44f8-af8b-a6cc35e769f4',
							name: 'Weekend picks',
							description: 'For Saturday',
							itemCount: 4,
							updatedAt: '2026-08-17T10:00:00.000Z'
						}
					],
					loadError: ''
				},
				form: null
			}
		});

		const desktopGrid = 'grid-cols-[32px_minmax(0,1fr)_90px_120px_40px]';
		expect(body.split(desktopGrid)).toHaveLength(3);
		expect(body).toContain('Last updated');
		expect(body).toContain('aria-label="Edit Weekend picks"');
	});
});
