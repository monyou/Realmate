import { TMDB_API_READ_ACCESS_TOKEN } from '$app/env/private';
import { getCurrentUser } from '#lib/server/auth.js';
import { ListGenerationError, searchTitles } from '#lib/server/generated-list.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!(await getCurrentUser(locals))) return new Response(null, { status: 401 });
	const query = url.searchParams.get('q')?.trim();
	if (!query || query.length > 200) return new Response(null, { status: 400 });
	try {
		return Response.json(await searchTitles(query, TMDB_API_READ_ACCESS_TOKEN ?? '', fetch));
	} catch (error) {
		if (!(error instanceof ListGenerationError)) throw error;
		return new Response(null, { status: error.status });
	}
};
