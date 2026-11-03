export const MAX_LIST_TITLES = 500;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportedTitle = {
	value: Record<string, unknown>;
	entry: number;
	issues: string[];
	original: string;
};

const fieldTypes = {
	title: 'string',
	type: 'string',
	genres: 'array',
	year: 'number',
	img: 'string',
	imdbRating: 'number',
	ratingSource: 'string',
	plot: 'string'
} as const;

export const parseMovieListImport = (text: string, existingCount: number): ImportedTitle[] => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
	} catch {
		throw new Error(
			'This file is not valid JSON. Check commas, quotes, and brackets, then try again.'
		);
	}
	if (!Array.isArray(parsed)) {
		throw new Error(
			'Use an array of title objects, starting with [ and ending with ]. Download the example to see the format.'
		);
	}
	if (parsed.length === 0) {
		throw new Error('This file has no titles. Add at least one title object and try again.');
	}
	if (parsed.length + existingCount > MAX_LIST_TITLES) {
		throw new Error(
			`A list can contain up to ${MAX_LIST_TITLES} titles. This file has ${parsed.length} and your draft already has ${existingCount}. Nothing was added.`
		);
	}

	return parsed.map((entry: unknown, index) => {
		const issues: string[] = [];
		const value: Record<string, unknown> =
			entry !== null && typeof entry === 'object' && !Array.isArray(entry)
				? (entry as Record<string, unknown>)
				: {};
		if (value !== entry) {
			issues.push(
				'This entry must be a title object. Fill in the fields below or remove this entry.'
			);
		}
		for (const [field, fieldValue] of Object.entries(value)) {
			if (!Object.hasOwn(fieldTypes, field)) {
				issues.push(`Unsupported field “${field}” will not be saved.`);
				continue;
			}
			const expected = fieldTypes[field as keyof typeof fieldTypes];
			if (
				expected === 'array'
					? !Array.isArray(fieldValue) || fieldValue.some((genre) => typeof genre !== 'string')
					: typeof fieldValue !== expected
			) {
				issues.push(
					`“${field}” must be ${expected === 'array' ? 'an array of genre names' : `a ${expected}`}. Its original value could not be used.`
				);
			}
		}
		if (typeof value.ratingSource === 'string' && !['IMDb', 'TMDB'].includes(value.ratingSource)) {
			issues.push('“ratingSource” must be “IMDb” or “TMDB”. The editor currently uses IMDb.');
		}
		if (typeof value.type === 'string' && value.type !== 'movie' && value.type !== 'series') {
			issues.push('“type” must be “movie” or “series”. Choose a type below.');
		}
		if (
			Array.isArray(value.genres) &&
			value.genres.some((genre) => typeof genre === 'string' && genre.includes(','))
		) {
			issues.push('Each genre must be a separate array entry. Review the genres shown below.');
		}
		return { value, entry: index + 1, issues, original: JSON.stringify(entry, null, 2) };
	});
};
