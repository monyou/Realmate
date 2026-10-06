import type { RequestHandler } from './$types';
import { emailValidationMessage } from '#lib/auth-validation.js';
import { requireSupabase, requireUser } from '#lib/server/auth.js';

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

const sharingError = (message: string, code?: string) => {
	if (message.startsWith('No account found for:'))
		return Response.json({ message }, { status: 400 });
	if (code === '42501' || message.startsWith('Only the list owner')) {
		return Response.json(
			{ message: 'Only the list owner can change sharing settings.' },
			{ status: 403 }
		);
	}
	return Response.json(
		{ message: 'Sharing settings could not be updated. Please try again.' },
		{ status: 500 }
	);
};

export const GET: RequestHandler = async ({ locals, params, setHeaders }) => {
	await requireUser(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!isUuid(params.id))
		return Response.json({ message: 'The selected list is invalid.' }, { status: 400 });

	const { data, error } = await requireSupabase(locals).rpc('get_movie_list_share_emails', {
		target_list_id: params.id
	});
	if (error) {
		console.error('Could not load movie list shares', error);
		return sharingError(error.message, error.code);
	}

	return Response.json({ emails: (data ?? []).map((share) => share.email) });
};

export const PUT: RequestHandler = async ({ request, locals, params, setHeaders }) => {
	const user = await requireUser(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!isUuid(params.id))
		return Response.json({ message: 'The selected list is invalid.' }, { status: 400 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ message: 'The sharing request could not be read.' }, { status: 400 });
	}
	const emails =
		body && typeof body === 'object' && Array.isArray((body as { emails?: unknown }).emails)
			? (body as { emails: unknown[] }).emails
			: null;
	if (!emails || emails.length > 100 || emails.some((email) => typeof email !== 'string')) {
		return Response.json({ message: 'Provide up to 100 valid email addresses.' }, { status: 400 });
	}

	const normalizedEmails = [...new Set(emails.map((email) => String(email).trim().toLowerCase()))];
	if (
		normalizedEmails.some((email) => email.length > 320 || Boolean(emailValidationMessage(email)))
	) {
		return Response.json(
			{ message: 'Every friend must have a valid email address.' },
			{ status: 400 }
		);
	}
	if (user.email && normalizedEmails.includes(user.email.toLowerCase())) {
		return Response.json({ message: 'You cannot share a list with its owner.' }, { status: 400 });
	}

	const { data, error } = await requireSupabase(locals).rpc('sync_movie_list_shares', {
		target_list_id: params.id,
		recipient_emails: normalizedEmails
	});
	if (error) {
		console.error('Could not update movie list shares', error);
		return sharingError(error.message, error.code);
	}

	return Response.json({ emails: (data ?? []).map((share) => share.email) });
};
