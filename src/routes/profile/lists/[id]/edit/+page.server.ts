import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSupabase, requireUser } from '$lib/server/auth';
import { validateMovieListForm } from '$lib/server/movie-list-form';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requireUser(locals);
	const { data, error: loadError } = await requireSupabase(locals)
		.from('movie_lists')
		.select('id, name, description, items, updated_at')
		.eq('id', params.id)
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
			items: data.items,
			updatedAt: data.updated_at
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		await requireUser(locals);
		const formData = await request.formData();
		const expectedUpdatedAt = String(formData.get('expectedUpdatedAt') ?? '');
		const list = validateMovieListForm(formData);
		if (!list.ok) {
			return fail(list.status, {
				message: list.message,
				values: { ...list.values, expectedUpdatedAt }
			});
		}
		if (!expectedUpdatedAt) {
			return fail(400, {
				message: 'The list version is missing. Refresh the page and try again.',
				values: {
					name: list.name,
					description: list.description,
					itemsJson: JSON.stringify(list.items),
					expectedUpdatedAt
				}
			});
		}

		const { data, error: updateError } = await requireSupabase(locals)
			.from('movie_lists')
			.update({ name: list.name, description: list.description, items: list.itemsJson })
			.eq('id', params.id)
			.eq('updated_at', expectedUpdatedAt)
			.select('id')
			.maybeSingle();

		const values = {
			name: list.name,
			description: list.description,
			itemsJson: JSON.stringify(list.items),
			expectedUpdatedAt
		};
		if (updateError) {
			console.error('Could not update movie list', updateError);
			return fail(500, { message: 'The list could not be updated. Please try again.', values });
		}
		if (!data) {
			return fail(409, {
				message:
					'This list changed after you opened it. Refresh the page to load the latest version, then edit it again.',
				values,
				conflict: true
			});
		}

		redirect(303, '/profile');
	}
};
