const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailValidationMessage = (email: string) => {
	if (!email.trim()) return 'Email is required.';
	if (!emailPattern.test(email.trim())) return 'Enter a valid email address.';
	return '';
};

export const loginPasswordValidationMessage = (password: string) =>
	password ? '' : 'Password is required.';

export const registrationPasswordValidationMessage = (password: string) => {
	if (!password) return 'Password is required.';
	if (password.length < 8) return 'Password must contain at least 8 characters.';
	return '';
};

export const confirmPasswordValidationMessage = (password: string, confirmation: string) => {
	if (!confirmation) return 'Confirm your password.';
	if (password !== confirmation) return 'Passwords do not match.';
	return '';
};
