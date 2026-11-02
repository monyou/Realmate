import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSupabase } from '#lib/server/auth.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const requestedNext = url.searchParams.get('next') ?? '/profile';
	let next = '/profile';
	try {
		const destination = new URL(requestedNext, url);
		// URL parsing also normalizes backslashes and control characters in destinations.
		if (
			requestedNext.startsWith('/') &&
			!requestedNext.startsWith('//') &&
			destination.origin === url.origin &&
			!destination.pathname.startsWith('//')
		) {
			next = destination.pathname + destination.search + destination.hash;
		}
	} catch {
		// Malformed destinations return to the profile after authentication.
	}

	if (code) {
		const { error } = await requireSupabase(locals).auth.exchangeCodeForSession(code);
		if (!error) redirect(303, next);
	}

	redirect(303, '/login?confirmation=failed');
};
