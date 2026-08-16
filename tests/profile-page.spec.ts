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
							updatedAt: '2026-08-17T10:00:00.000Z',
							isOwner: true,
							isShared: true
						},
						{
							id: 'bb8e8d8b-1a6a-4238-a184-8cd15ddcd094',
							name: 'Shared by a friend',
							description: '',
							itemCount: 2,
							updatedAt: '2026-08-17T11:00:00.000Z',
							isOwner: false,
							isShared: true
						}
					],
					loadError: ''
				},
				form: null
			}
		});

		const desktopGrid = 'grid-cols-[32px_28px_minmax(0,1fr)_90px_120px_120px]';
		expect(body.split(desktopGrid)).toHaveLength(4);
		expect(body).toContain('Last updated');
		expect(body).toContain('aria-label="Edit Weekend picks"');
		expect(body).toContain('aria-label="Share Weekend picks"');
		expect(body).toContain('aria-label="Delete Weekend picks"');
		expect(body).toContain('aria-label="Shared by a friend is shared"');
		expect(body).toContain('aria-label="Edit Shared by a friend"');
		expect(body).not.toContain('aria-label="Share Shared by a friend"');
		expect(body).not.toContain('aria-label="Delete Shared by a friend"');
		expect(body).toContain('data-close-dialog-on-success="true"');
	});
});
