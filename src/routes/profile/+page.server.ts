import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSupabase, requireUser } from '$lib/server/auth';
import { PartyEngine } from '$lib/server/party-engine';
import { createParty } from '$lib/server/party-store';
import { getPlayerIdentity } from '$lib/server/player-identity';
import type { SourceMedia } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await requireUser(locals);
	const { data, error } = await requireSupabase(locals)
		.from('movie_lists')
		.select('id, name, description, items, created_at, updated_at')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Could not load movie lists', error);
		return {
			user: { email: user.email ?? '' },
			lists: [],
			loadError: 'Your lists could not be loaded.'
		};
	}

	return {
		user: { email: user.email ?? '' },
		lists: data.map((list) => ({
			id: list.id,
			name: list.name,
			description: list.description,
			itemCount: Array.isArray(list.items) ? list.items.length : 0,
			updatedAt: list.updated_at ?? list.created_at
		})),
		loadError: ''
	};
};

export const actions: Actions = {
	startParty: async ({ request, locals, cookies, url }) => {
		const user = await requireUser(locals);
		const formData = await request.formData();
		const selectedIds = [
			...new Set(
				formData
					.getAll('listId')
					.map(String)
					.filter((value) => /^[0-9a-f-]{36}$/i.test(value))
			)
		];
		if (selectedIds.length === 0) return fail(400, { message: 'Select at least one list.' });

		const { data, error } = await requireSupabase(locals)
			.from('movie_lists')
			.select('id, items')
			.eq('user_id', user.id)
			.in('id', selectedIds);
		if (error || data.length !== selectedIds.length) {
			return fail(400, { message: 'One or more selected lists are unavailable.' });
		}

		const items = data.flatMap((list) =>
			Array.isArray(list.items) ? list.items : []
		) as SourceMedia;

		try {
			new PartyEngine(items);
		} catch (validationError) {
			return fail(400, {
				message:
					validationError instanceof Error
						? validationError.message
						: 'The selected lists are invalid.'
			});
		}

		const playerId = getPlayerIdentity(cookies, url.protocol === 'https:');
		const playerName = user.email?.split('@')[0] ?? 'Host';
		let created: Awaited<ReturnType<typeof createParty>>;
		try {
			created = await createParty(items, playerId, playerName);
		} catch (partyError) {
			console.error('Could not create party from selected lists', partyError);
			return fail(503, { message: 'The matching room could not be created. Please try again.' });
		}
		redirect(303, `/?room=${encodeURIComponent(created.roomId)}`);
	},
	logout: async ({ locals }) => {
		if (locals.supabase) await locals.supabase.auth.signOut();
		redirect(303, '/');
	}
};
