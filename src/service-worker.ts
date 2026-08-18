/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { base, build, files, version } from '$service-worker';

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const cacheName = `realmate-${version}`;
const assets = [...build, ...files];
const offlinePage = `${base}/offline.html`;

worker.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== cacheName) await caches.delete(key);
			}
			await worker.clients.claim();
		})()
	);
});

worker.addEventListener('fetch', (event) => {
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

	if (url.origin === worker.location.origin && assets.includes(url.pathname)) {
		event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
	}
});
