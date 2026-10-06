import { version } from '$app/env';
import { assets as staticAssets, immutable } from '$app/manifest';
import { asset, resolve } from '$app/paths';
import { self } from '$app/service-worker';

const cacheName = `realmate-${version}`;
const appRoot = resolve('/');

const assets = [
	// Generated assets are relative to the app root, but are not typed application routes.
	...immutable.map(({ path }) => `${appRoot}${path}`),
	...staticAssets.map(({ path }) => asset(path))
];

const assetPathnames = new Set(
	assets
		.map((path) => new URL(path, self.location.origin))
		.filter((url) => url.origin === self.location.origin)
		.map((url) => url.pathname)
);

const offlinePage = asset('offline.html');

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== cacheName) {
					await caches.delete(key);
				}
			}

			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request).catch(async () => {
				const fallback = await caches.match(offlinePage);
				return fallback ?? Response.error();
			})
		);

		return;
	}

	if (url.origin === self.location.origin && assetPathnames.has(url.pathname)) {
		event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
	}
});
