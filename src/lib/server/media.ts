import type { MediaItem } from '$lib/types';

export const mediaBlobUrl = 'https://epureihf1azmctan.public.blob.vercel-storage.com/media.json';

export type SourceMedia = (Omit<MediaItem, 'id'> & { id?: string })[];

export const loadMedia = async (): Promise<SourceMedia> => {
	const response = await fetch(mediaBlobUrl, {
		cache: 'no-store',
		headers: { accept: 'application/json' },
		signal: AbortSignal.timeout(7_000)
	});
	if (!response.ok) {
		throw new Error(
			`Unable to load media from Vercel Blob (${response.status} ${response.statusText})`
		);
	}

	const media: unknown = await response.json();
	if (!Array.isArray(media)) throw new Error('Vercel Blob media.json must contain a JSON array');
	return media as SourceMedia;
};
