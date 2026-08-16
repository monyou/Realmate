import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LoginPage from '../src/routes/login/+page.svelte';
import RegisterPage from '../src/routes/register/+page.svelte';

describe('auth pages', () => {
	it('renders login without initial validation feedback', () => {
		const { body } = render(LoginPage, {
			props: {
				data: { configured: true, confirmationFailed: false },
				form: null
			}
		});

		expect(body).toContain('novalidate=""');
		expect(body).toContain('aria-invalid="false"');
		expect(body).not.toContain('Email is required.');
		expect(body).not.toContain('Password is required.');
	});

	it('renders registration without initial validation feedback', () => {
		const { body } = render(RegisterPage, {
			props: {
				data: { configured: true },
				form: null
			}
		});

		expect(body).toContain('novalidate=""');
		expect(body).toContain('aria-invalid="false"');
		expect(body).not.toContain('Email is required.');
		expect(body).not.toContain('Password is required.');
		expect(body).not.toContain('Confirm your password.');
	});
});
