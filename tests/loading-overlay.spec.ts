import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';

describe('LoadingOverlay', () => {
	it('renders an accessible blocking loader while work is in progress', () => {
		const { body } = render(LoadingOverlay, {
			props: { visible: true, label: 'Opening list…' }
		});

		expect(body).toContain('data-loading-overlay');
		expect(body).toContain('role="status"');
		expect(body).toContain('aria-label="Opening list…"');
		expect(body).toContain('animate-[reel-spin_1.15s_linear_infinite]');
	});

	it('does not render when the app is idle', () => {
		const { body } = render(LoadingOverlay, { props: { visible: false } });

		expect(body).not.toContain('data-loading-overlay');
	});
});
