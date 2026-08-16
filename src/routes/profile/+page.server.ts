import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSupabase, requireUser } from '$lib/server/auth';
import { PartyEngine } from '$lib/server/party-engine';
import { createParty } from '$lib/server/party-store';
import { getPlayerIdentity } from '$lib/server/player-identity';
import type { SourceMedia } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await requireUser(locals);
	const supabase = requireSupabase(locals);
	const { data, error } = await supabase
		.from('movie_lists')
		.select('id, user_id, name, description, items, created_at, updated_at')
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('Could not load movie lists', error);
		return {
			user: { email: user.email ?? '' },
			lists: [],
			loadError: 'Your lists could not be loaded.'
		};
	}

	const ownedIds = data.filter((list) => list.user_id === user.id).map((list) => list.id);
	let sharedOwnedIds = new Set<string>();
	if (ownedIds.length > 0) {
		const { data: shares, error: sharesError } = await supabase
			.from('movie_list_shares')
			.select('list_id')
			.in('list_id', ownedIds);
		if (sharesError) {
			console.error('Could not load movie list sharing metadata', sharesError);
			return {
				user: { email: user.email ?? '' },
				lists: [],
				loadError: 'Your lists could not be loaded.'
			};
		}
		sharedOwnedIds = new Set(shares.map((share) => share.list_id));
	}

	return {
		user: { email: user.email ?? '' },
		lists: data.map((list) => ({
			id: list.id,
			name: list.name,
			description: list.description,
			itemCount: Array.isArray(list.items) ? list.items.length : 0,
			updatedAt: list.updated_at ?? list.created_at,
			isOwner: list.user_id === user.id,
			isShared: list.user_id !== user.id || sharedOwnedIds.has(list.id)
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
	deleteList: async ({ request, locals }) => {
		const user = await requireUser(locals);
		const listId = String((await request.formData()).get('listId') ?? '');
		if (!/^[0-9a-f-]{36}$/i.test(listId)) {
			return fail(400, { message: 'The selected list is invalid.' });
		}

		const { data, error } = await requireSupabase(locals)
			.from('movie_lists')
			.delete()
			.eq('id', listId)
			.eq('user_id', user.id)
			.select('id')
			.maybeSingle();

		if (error) {
			console.error('Could not delete movie list', error);
			return fail(500, { message: 'The list could not be deleted. Please try again.' });
		}
		if (!data) return fail(404, { message: 'The list was not found or you do not own it.' });

		return { deleted: true };
	},
	logout: async ({ locals }) => {
		if (locals.supabase) await locals.supabase.auth.signOut();
		redirect(303, '/');
	}
};
