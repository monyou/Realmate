import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the app, but do not override third-party Svelte packages.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		serviceWorker: {
			files: (filepath) => !filepath.endsWith('.DS_Store')
		}
	}
};

export default config;
