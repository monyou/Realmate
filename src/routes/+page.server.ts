import type { PageServerLoad } from './$types';
import { getCurrentUser } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await getCurrentUser(locals);
	return {
		configured: Boolean(locals.supabase),
		roomId: url.searchParams.get('room') ?? '',
		user: user ? { email: user.email ?? '' } : null
	};
};
