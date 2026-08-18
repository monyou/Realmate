import { PartyEngine } from '$lib/server/party-engine';
import type { SourceMedia, Json } from '$lib/types';

export type MovieListFormValues = {
	name: string;
	description: string;
	itemsJson: string;
};

type ValidMovieList = {
	ok: true;
	name: string;
	description: string;
	items: SourceMedia;
	itemsJson: Json;
};

type InvalidMovieList = {
	ok: false;
	status: 400;
	message: string;
	values: MovieListFormValues;
};

export const validateMovieListForm = (formData: FormData): ValidMovieList | InvalidMovieList => {
	const name = String(formData.get('name') ?? '').trim();
	const description = String(formData.get('description') ?? '').trim();
	const itemsJson = String(formData.get('items') ?? '[]');
	const values = { name, description, itemsJson };

	if (!name || name.length > 80) {
		return {
			ok: false,
			status: 400,
			message: 'List name must be between 1 and 80 characters.',
			values
		};
	}
	if (description.length > 500) {
		return {
			ok: false,
			status: 400,
			message: 'Description cannot exceed 500 characters.',
			values
		};
	}
	let items: unknown;
	try {
		items = JSON.parse(itemsJson);
	} catch {
		return {
			ok: false,
			status: 400,
			message: 'The list data could not be read. Please try again.',
			values
		};
	}

	try {
		new PartyEngine(items as SourceMedia);
	} catch (validationError) {
		return {
			ok: false,
			status: 400,
			message:
				validationError instanceof Error
					? validationError.message
					: 'Check every title and try again.',
			values
		};
	}

	if ((items as SourceMedia).length > 500) {
		return {
			ok: false,
			status: 400,
			message: 'A list can contain up to 500 titles.',
			values
		};
	}
	const normalizedItems = (items as SourceMedia).map((item) => ({
		...item,
		img: item.img ?? '',
		imdbRating: item.imdbRating ?? 0,
		plot: item.plot ?? ''
	}));

	return {
		ok: true,
		name,
		description,
		items: normalizedItems,
		itemsJson: normalizedItems as Json
	};
};
