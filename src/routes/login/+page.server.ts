import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCurrentUser, requireSupabase } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (await getCurrentUser(locals)) redirect(303, '/profile');
	return {
		configured: Boolean(locals.supabase),
		confirmationFailed: url.searchParams.get('confirmation') === 'failed'
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { message: 'Enter both your email and password.', email });
		}
		if (!locals.supabase) {
			return fail(503, {
				message: 'Supabase is not configured yet. Add the project URL and publishable key.',
				email
			});
		}

		const supabase = requireSupabase(locals);
		const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
		if (authError) {
			return fail(400, { message: 'The email or password is incorrect.', email });
		}

		redirect(303, '/profile');
	}
};
