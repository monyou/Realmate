import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCurrentUser, requireSupabase } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (await getCurrentUser(locals)) redirect(303, '/profile');
	return { configured: Boolean(locals.supabase) };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '');
		const confirmPassword = String(formData.get('confirmPassword') ?? '');

		if (!email || !password)
			return fail(400, { message: 'Email and password are required.', email });
		if (password.length < 8)
			return fail(400, { message: 'Use at least 8 characters for your password.', email });
		if (password !== confirmPassword)
			return fail(400, { message: 'The passwords do not match.', email });
		if (!locals.supabase) {
			return fail(503, {
				message: 'Supabase is not configured yet. Add the project URL and publishable key.',
				email
			});
		}

		const supabase = requireSupabase(locals);
		const { data, error: authError } = await supabase.auth.signUp({
			email,
			password,
			options: { emailRedirectTo: `${url.origin}/auth/callback?next=/profile` }
		});
		if (authError) return fail(400, { message: authError.message, email });
		if (data.session) redirect(303, '/profile');

		return {
			success: true,
			message: 'Check your email and confirm your account, then log in.',
			email
		};
	}
};
