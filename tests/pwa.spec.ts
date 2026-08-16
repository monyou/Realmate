import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const staticPath = (...parts: string[]) => resolve(projectRoot, 'static', ...parts);

const pngDimensions = (path: string) => {
	const image = readFileSync(path);
	return {
		width: image.readUInt32BE(16),
		height: image.readUInt32BE(20)
	};
};

describe('PWA configuration', () => {
	it('provides an installable standalone manifest with valid icons', () => {
		const manifest = JSON.parse(readFileSync(staticPath('manifest.webmanifest'), 'utf8')) as {
			name: string;
			short_name: string;
			start_url: string;
			display: string;
			icons: { src: string; sizes: string; purpose: string }[];
		};

		expect(manifest).toMatchObject({
			short_name: 'Reelmate',
			start_url: '/',
			display: 'standalone'
		});
		expect(manifest.name).toContain('Reelmate');
		expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
		expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
		expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

		for (const icon of manifest.icons) {
			expect(existsSync(staticPath(icon.src.replace(/^\//, '')))).toBe(true);
		}
		expect(pngDimensions(staticPath('icons/icon-192.png'))).toEqual({
			width: 192,
			height: 192
		});
		expect(pngDimensions(staticPath('icons/icon-512.png'))).toEqual({
			width: 512,
			height: 512
		});
	});

	it('links global PWA metadata and provides an offline fallback', () => {
		const appHtml = readFileSync(resolve(projectRoot, 'src/app.html'), 'utf8');
		const offlineHtml = readFileSync(staticPath('offline.html'), 'utf8');

		expect(appHtml).toContain('rel="manifest"');
		expect(appHtml).toContain('name="theme-color"');
		expect(appHtml).toContain('rel="apple-touch-icon"');
		expect(offlineHtml).toContain('You’re offline');
		expect(offlineHtml).toContain('Reelmate needs a connection');
	});

	it('keeps authenticated navigation network-first and only precaches static assets', () => {
		const serviceWorker = readFileSync(resolve(projectRoot, 'src/service-worker.ts'), 'utf8');

		expect(serviceWorker).toContain("event.request.mode === 'navigate'");
		expect(serviceWorker).toContain('fetch(event.request).catch');
		expect(serviceWorker).toContain('caches.match(offlinePage)');
		expect(serviceWorker).toContain('assets.includes(url.pathname)');
		expect(serviceWorker).not.toContain("'/api/");
	});
});
