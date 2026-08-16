import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSupabase, requireUser } from '$lib/server/auth';
import { validateMovieListForm } from '$lib/server/movie-list-form';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = await requireUser(locals);
	const { data, error: loadError } = await requireSupabase(locals)
		.from('movie_lists')
		.select('id, name, description, items')
		.eq('id', params.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (loadError) {
		console.error('Could not load movie list for editing', loadError);
		error(500, 'The list could not be loaded.');
	}
	if (!data) error(404, 'The list was not found.');

	return {
		list: {
			id: data.id,
			name: data.name,
			description: data.description,
			items: data.items
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		const user = await requireUser(locals);
		const list = validateMovieListForm(await request.formData());
		if (!list.ok) return fail(list.status, { message: list.message, values: list.values });

		const { data, error: updateError } = await requireSupabase(locals)
			.from('movie_lists')
			.update({ name: list.name, description: list.description, items: list.itemsJson })
			.eq('id', params.id)
			.eq('user_id', user.id)
			.select('id')
			.maybeSingle();

		const values = {
			name: list.name,
			description: list.description,
			itemsJson: JSON.stringify(list.items)
		};
		if (updateError) {
			console.error('Could not update movie list', updateError);
			return fail(500, { message: 'The list could not be updated. Please try again.', values });
		}
		if (!data) return fail(404, { message: 'The list was not found.', values });

		redirect(303, '/profile');
	}
};
