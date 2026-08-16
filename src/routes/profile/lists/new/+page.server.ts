import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSupabase, requireUser } from '$lib/server/auth';
import { validateMovieListForm } from '$lib/server/movie-list-form';

export const load: PageServerLoad = async ({ locals }) => {
	await requireUser(locals);
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = await requireUser(locals);
		const list = validateMovieListForm(await request.formData());
		if (!list.ok) return fail(list.status, { message: list.message, values: list.values });
		const { error } = await requireSupabase(locals).from('movie_lists').insert({
			user_id: user.id,
			name: list.name,
			description: list.description,
			items: list.itemsJson
		});
		if (error) {
			console.error('Could not create movie list', error);
			return fail(500, {
				message: 'The list could not be saved. Please try again.',
				values: {
					name: list.name,
					description: list.description,
					itemsJson: JSON.stringify(list.items)
				}
			});
		}

		redirect(303, '/profile');
	}
};
