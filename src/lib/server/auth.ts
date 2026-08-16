import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

type Locals = RequestEvent['locals'];

export const getCurrentUser = async (locals: Locals) => {
	if (!locals.supabase) return null;
	const { data, error: authError } = await locals.supabase.auth.getUser();
	if (authError) return null;
	locals.user = data.user;
	return data.user;
};

export const requireSupabase = (locals: Locals) => {
	if (!locals.supabase) {
		error(503, 'Supabase is not configured. Add the public project URL and publishable key.');
	}
	return locals.supabase;
};

export const requireUser = async (locals: Locals) => {
	const supabase = requireSupabase(locals);
	const { data, error: authError } = await supabase.auth.getUser();
	if (authError || !data.user) redirect(303, '/login');
	locals.user = data.user;
	return data.user;
};
