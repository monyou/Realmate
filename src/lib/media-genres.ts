export const MEDIA_GENRES = [
	'Action',
	'Adventure',
	'Animation',
	'Biography',
	'Comedy',
	'Crime',
	'Documentary',
	'Drama',
	'Family',
	'Fantasy',
	'Film-Noir',
	'Game-Show',
	'History',
	'Horror',
	'Music',
	'Musical',
	'Mystery',
	'News',
	'Reality-TV',
	'Romance',
	'Sci-Fi',
	'Short',
	'Sport',
	'Talk-Show',
	'Thriller',
	'War',
	'Western'
] as const;

export type MediaGenre = (typeof MEDIA_GENRES)[number];

type GenreValidation =
	| { valid: true; genres: MediaGenre[]; message: '' }
	| { valid: false; genres: []; message: string };

const genreKey = (genre: string) =>
	genre
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, ' ');

const genreByKey = new Map(MEDIA_GENRES.map((genre) => [genreKey(genre), genre]));

const matchingGenre = (value: string) => genreByKey.get(genreKey(value));

const genreInputParts = (value: string) => {
	const parts = value.split(',');
	const current = parts.pop()?.trim() ?? '';
	const completed = parts.map((genre) => genre.trim()).filter(Boolean);
	const currentGenre = current ? matchingGenre(current) : undefined;
	return { completed, current, currentGenre };
};

export const genreSuggestions = (value: string): MediaGenre[] => {
	const { completed, current, currentGenre } = genreInputParts(value);
	const selected = new Set(
		[...completed, ...(currentGenre ? [currentGenre] : [])]
			.map(matchingGenre)
			.filter((genre): genre is MediaGenre => Boolean(genre))
	);
	if (selected.size >= 3) return [];

	const query = currentGenre ? '' : genreKey(current);
	return MEDIA_GENRES.filter(
		(genre) => !selected.has(genre) && (!query || genreKey(genre).includes(query))
	);
};

export const applyGenreSuggestion = (value: string, suggestion: MediaGenre) => {
	const { completed, currentGenre } = genreInputParts(value);
	const selected = [...completed, ...(currentGenre ? [currentGenre] : [])]
		.map(matchingGenre)
		.filter((genre): genre is MediaGenre => Boolean(genre));
	if (!selected.includes(suggestion) && selected.length < 3) selected.push(suggestion);
	return selected.join(', ');
};

export const validateMediaGenres = (value: unknown): GenreValidation => {
	if (!Array.isArray(value) || value.length === 0) {
		return { valid: false, genres: [], message: 'At least one genre is required.' };
	}
	if (value.length > 3) {
		return { valid: false, genres: [], message: 'Choose no more than 3 genres.' };
	}

	const genres: MediaGenre[] = [];
	const unknownGenres: string[] = [];
	for (const valueGenre of value) {
		if (typeof valueGenre !== 'string') {
			return { valid: false, genres: [], message: 'Every genre must be a name.' };
		}
		if (!valueGenre.trim()) {
			return {
				valid: false,
				genres: [],
				message: 'Genre names cannot be empty. Separate each genre with one comma.'
			};
		}

		const genre = matchingGenre(valueGenre);
		if (!genre) {
			unknownGenres.push(valueGenre.trim());
			continue;
		}
		if (genres.includes(genre)) {
			return {
				valid: false,
				genres: [],
				message: `Remove the duplicate genre “${genre}”.`
			};
		}
		genres.push(genre);
	}

	if (unknownGenres.length > 0) {
		return {
			valid: false,
			genres: [],
			message: `${unknownGenres.length === 1 ? 'Unknown genre' : 'Unknown genres'}: ${unknownGenres.join(', ')}.`
		};
	}

	return { valid: true, genres, message: '' };
};

export const validateGenreInput = (value: string) =>
	validateMediaGenres(value.trim() ? value.split(',') : []);
