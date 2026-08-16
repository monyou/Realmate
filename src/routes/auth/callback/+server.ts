import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSupabase } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	let next = url.searchParams.get('next') ?? '/profile';
	if (!next.startsWith('/') || next.startsWith('//')) next = '/profile';

	if (code) {
		const { error } = await requireSupabase(locals).auth.exchangeCodeForSession(code);
		if (!error) redirect(303, next);
	}

	redirect(303, '/login?confirmation=failed');
};
