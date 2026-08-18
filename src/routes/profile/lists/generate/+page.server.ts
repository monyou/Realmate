import { requireSupabase, requireUser } from '$lib/server/auth';
import { env } from '$env/dynamic/private';
import {
	ListGenerationError,
	generateListFromTmdb,
	validateGenerationCriteria
} from '$lib/server/generated-list';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireUser(locals);
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = await requireUser(locals);
		const supabase = requireSupabase(locals);
		const validated = validateGenerationCriteria(await request.formData());
		if (!validated.ok) {
			return fail(validated.status, { message: validated.message, values: validated.values });
		}

		let generated: Awaited<ReturnType<typeof generateListFromTmdb>>;
		try {
			generated = await generateListFromTmdb(
				validated.criteria,
				env.TMDB_API_READ_ACCESS_TOKEN ?? ''
			);
		} catch (error) {
			if (error instanceof ListGenerationError) {
				return fail(error.status, { message: error.message, values: validated.values });
			}
			console.error('Could not generate movie list', error);
			return fail(500, {
				message: 'The generated list could not be prepared. Please try again.',
				values: validated.values
			});
		}

		const { error } = await supabase.from('movie_lists').insert({
			user_id: user.id,
			name: generated.name,
			description: generated.description,
			items: generated.itemsJson
		});
		if (error) {
			console.error('Could not save generated movie list', error);
			return fail(500, {
				message: 'The list was generated but could not be saved. Please try again.',
				values: validated.values
			});
		}

		redirect(303, '/profile');
	}
};
