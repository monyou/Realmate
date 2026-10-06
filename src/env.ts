import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: { public: true, schema: (input) => input ?? '' },
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: { public: true, schema: (input) => input ?? '' },
	TMDB_API_READ_ACCESS_TOKEN: { schema: (input) => input ?? '' },
	UPSTASH_REDIS_REST_URL: { schema: (input) => input ?? '' },
	UPSTASH_REDIS_REST_TOKEN: { schema: (input) => input ?? '' }
});
