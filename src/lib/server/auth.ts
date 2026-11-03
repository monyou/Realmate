import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

type Locals = RequestEvent['locals'];

export const getCurrentUser = (locals: Locals) => locals.getUser();

export const requireSupabase = (locals: Locals) => {
	if (!locals.supabase) {
		error(503, 'Supabase is not configured. Add the public project URL and publishable key.');
	}
	return locals.supabase;
};

export const requireUser = async (locals: Locals) => {
	requireSupabase(locals);
	const user = await getCurrentUser(locals);
	if (!user) redirect(303, '/login');
	return user;
};
