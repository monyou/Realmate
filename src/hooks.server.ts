import { env } from '$env/dynamic/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import type { Database } from '$lib/types';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = null;
	event.locals.user = null;
	// Supabase may update PKCE/session storage more than once during one request.
	// Buffer its response headers so SvelteKit receives each header only once.
	const supabaseResponseHeaders = new Headers();

	if (env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
		event.locals.supabase = createServerClient<Database>(
			env.PUBLIC_SUPABASE_URL,
			env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
			{
				cookies: {
					getAll: () => event.cookies.getAll(),
					setAll: (cookiesToSet, headers) => {
						for (const { name, value, options } of cookiesToSet) {
							event.cookies.set(name, value, { ...options, path: '/' });
						}
						for (const [name, value] of Object.entries(headers)) {
							supabaseResponseHeaders.set(name, value);
						}
					}
				}
			}
		);
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});

	for (const [name, value] of supabaseResponseHeaders) response.headers.set(name, value);
	return response;
};
