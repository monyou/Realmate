import { describe, expect, it } from 'vitest';
import {
	confirmPasswordValidationMessage,
	emailValidationMessage,
	loginPasswordValidationMessage,
	registrationPasswordValidationMessage
} from '$lib/auth-validation';

describe('auth validation', () => {
	it.each([
		['', 'Email is required.'],
		['not-an-email', 'Enter a valid email address.'],
		['viewer@example.com', '']
	])('validates email %j', (email, expected) => {
		expect(emailValidationMessage(email)).toBe(expected);
	});

	it('requires a login password', () => {
		expect(loginPasswordValidationMessage('')).toBe('Password is required.');
		expect(loginPasswordValidationMessage('secret')).toBe('');
	});

	it('requires an eight-character registration password', () => {
		expect(registrationPasswordValidationMessage('')).toBe('Password is required.');
		expect(registrationPasswordValidationMessage('short')).toContain('8 characters');
		expect(registrationPasswordValidationMessage('long-enough')).toBe('');
	});

	it('requires matching password confirmation', () => {
		expect(confirmPasswordValidationMessage('long-enough', '')).toBe('Confirm your password.');
		expect(confirmPasswordValidationMessage('long-enough', 'different')).toBe(
			'Passwords do not match.'
		);
		expect(confirmPasswordValidationMessage('long-enough', 'long-enough')).toBe('');
	});
});
