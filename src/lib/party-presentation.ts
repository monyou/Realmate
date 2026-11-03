import { asset } from '$app/paths';
import type { MediaItem } from '#lib/types.js';

const defaultPoster = asset('assets/default_poster.jpeg');
const avatarColors = [
	'bg-[linear-gradient(145deg,#ff7c67,#df345d)]',
	'bg-[linear-gradient(145deg,#8b7dff,#5a3fd1)]',
	'bg-[linear-gradient(145deg,#43ddb8,#168b83)]',
	'bg-[linear-gradient(145deg,#f6c860,#e47d3e)]',
	'bg-[linear-gradient(145deg,#59b8ff,#3154cc)]',
	'bg-[linear-gradient(145deg,#e879f9,#9b3fc2)]'
];

export function playerInitials(name: string) {
	return name
		.split(' ')
		.map((word) => word[0])
		.join('')
		.slice(0, 2);
}

export function avatarColor(avatar: number) {
	return avatarColors[avatar % avatarColors.length];
}

export function mediaLabel(item: MediaItem) {
	return item.type === 'movie' ? 'Movie' : 'Series';
}

export function ratingLabel(item: MediaItem) {
	return item.imdbRating > 0 ? item.imdbRating.toFixed(1) : '?';
}

export function ratingAriaLabel(item: MediaItem) {
	const source = item.ratingSource ?? 'IMDb';
	return item.imdbRating > 0
		? `${source} rating ${ratingLabel(item)} out of 10`
		: `${source} rating unknown`;
}

export function posterSource(item: MediaItem) {
	return item.img.trim() || defaultPoster;
}

export function useDefaultPoster(event: Event) {
	const image = event.currentTarget as HTMLImageElement;
	if (!image.src.endsWith(defaultPoster)) image.src = defaultPoster;
}
