import {
	MAX_FILTER_GENRES,
	MAX_GENERATED_RESULTS,
	type FilterOperator,
	type GeneratedMediaType,
	type GenerationCriteria,
	type GenerationCriteriaValues
} from '$lib/generated-list';
import { MEDIA_GENRES, validateMediaGenres, type MediaGenre } from '$lib/media-genres';
import { truncateMediaPlot } from '$lib/media-plot';
import { validateMovieListForm } from '$lib/server/movie-list-form';
import type { Json, MediaKind, SourceMedia } from '$lib/types';

export const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
export const MAX_TMDB_PAGES = 500;
export const TMDB_PAGES_PER_FILTER = 3;
export const GENERATED_LIST_DESCRIPTION = 'Randomly generated from matching TMDB results.';

type ValidCriteria = { ok: true; criteria: GenerationCriteria; values: GenerationCriteriaValues };
type InvalidCriteria = {
	ok: false;
	status: 400;
	message: string;
	values: GenerationCriteriaValues;
};

export type TmdbFetcher = (
	input: string | URL | globalThis.Request,
	init?: RequestInit
) => Promise<Response>;

export class ListGenerationError extends Error {
	constructor(
		message: string,
		readonly status: 422 | 429 | 500 | 503 = 503
	) {
		super(message);
		this.name = 'ListGenerationError';
	}
}

const isOperator = (value: string): value is FilterOperator => value === '>=' || value === '<=';
const isMediaType = (value: string): value is GeneratedMediaType =>
	value === 'movie' || value === 'series' || value === 'both';
const numberFromInput = (value: string) => (value.trim() ? Number(value) : Number.NaN);

export const validateGenerationCriteria = (
	formData: FormData,
	currentYear = new Date().getFullYear()
): ValidCriteria | InvalidCriteria => {
	const values: GenerationCriteriaValues = {
		type: String(formData.get('type') ?? ''),
		yearOperator: String(formData.get('yearOperator') ?? ''),
		year: String(formData.get('year') ?? ''),
		genres: formData.getAll('genres').map(String),
		ratingOperator: String(formData.get('ratingOperator') ?? ''),
		rating: String(formData.get('rating') ?? ''),
		limit: String(formData.get('limit') ?? '')
	};
	const year = numberFromInput(values.year);
	const rating = numberFromInput(values.rating);
	const limit = numberFromInput(values.limit);

	if (!isMediaType(values.type)) {
		return { ok: false, status: 400, message: 'Choose movies, series, or both.', values };
	}
	if (!isOperator(values.yearOperator)) {
		return { ok: false, status: 400, message: 'Choose a valid year condition.', values };
	}
	if (!Number.isInteger(year) || year < 1888 || year > currentYear) {
		return {
			ok: false,
			status: 400,
			message: `Year must be a whole number from 1888 to ${currentYear}.`,
			values
		};
	}
	if (values.genres.length === 0 || values.genres.length > MAX_FILTER_GENRES) {
		return {
			ok: false,
			status: 400,
			message: `Choose between 1 and ${MAX_FILTER_GENRES} genres.`,
			values
		};
	}
	const uniqueGenreValues = [...new Set(values.genres)];
	if (uniqueGenreValues.length !== values.genres.length) {
		return { ok: false, status: 400, message: 'Choose each genre only once.', values };
	}
	const unknownGenre = uniqueGenreValues.find(
		(genre) => !MEDIA_GENRES.includes(genre as MediaGenre)
	);
	if (unknownGenre) {
		return { ok: false, status: 400, message: `Unknown genre: ${unknownGenre}.`, values };
	}
	if (!isOperator(values.ratingOperator)) {
		return { ok: false, status: 400, message: 'Choose a valid rating condition.', values };
	}
	if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
		return { ok: false, status: 400, message: 'Rating must be from 0 to 10.', values };
	}
	if (!Number.isInteger(limit) || limit < 1 || limit > MAX_GENERATED_RESULTS) {
		return {
			ok: false,
			status: 400,
			message: `Number of results must be from 1 to ${MAX_GENERATED_RESULTS}.`,
			values
		};
	}

	return {
		ok: true,
		values,
		criteria: {
			type: values.type,
			yearOperator: values.yearOperator,
			year,
			genres: uniqueGenreValues as MediaGenre[],
			ratingOperator: values.ratingOperator,
			rating,
			limit
		}
	};
};

const MOVIE_GENRE_IDS: Partial<Record<MediaGenre, number>> = {
	Action: 28,
	Adventure: 12,
	Animation: 16,
	Comedy: 35,
	Crime: 80,
	Documentary: 99,
	Drama: 18,
	Family: 10751,
	Fantasy: 14,
	History: 36,
	Horror: 27,
	Music: 10402,
	Mystery: 9648,
	Romance: 10749,
	'Sci-Fi': 878,
	Thriller: 53,
	War: 10752,
	Western: 37
};

const SERIES_GENRE_IDS: Partial<Record<MediaGenre, number>> = {
	Animation: 16,
	Comedy: 35,
	Crime: 80,
	Documentary: 99,
	Drama: 18,
	Family: 10751,
	Mystery: 9648,
	News: 10763,
	'Reality-TV': 10764,
	'Talk-Show': 10767,
	Western: 37
};

const KEYWORD_QUERIES: Record<MediaGenre, string> = {
	Action: 'action',
	Adventure: 'adventure',
	Animation: 'animation',
	Biography: 'biography',
	Comedy: 'comedy',
	Crime: 'crime',
	Documentary: 'documentary',
	Drama: 'drama',
	Family: 'family',
	Fantasy: 'fantasy',
	'Film-Noir': 'film noir',
	'Game-Show': 'game show',
	History: 'history',
	Horror: 'horror',
	Music: 'music',
	Musical: 'musical',
	Mystery: 'mystery',
	News: 'news',
	'Reality-TV': 'reality tv',
	Romance: 'romance',
	'Sci-Fi': 'science fiction',
	Short: 'short film',
	Sport: 'sport',
	'Talk-Show': 'talk show',
	Thriller: 'thriller',
	War: 'war',
	Western: 'western'
};

type TmdbMediaType = 'movie' | 'tv';
export type TmdbFilter = {
	mediaType: TmdbMediaType;
	requestedGenres: MediaGenre[];
	genreIds: number[];
	keywordIds: number[];
};

const genreIdsForType = (mediaType: TmdbMediaType) =>
	mediaType === 'movie' ? MOVIE_GENRE_IDS : SERIES_GENRE_IDS;

const mediaTypesForCriteria = (type: GeneratedMediaType): TmdbMediaType[] =>
	type === 'movie' ? ['movie'] : type === 'series' ? ['tv'] : ['movie', 'tv'];

export const buildTmdbDiscoverUrl = (
	criteria: GenerationCriteria,
	filter: TmdbFilter,
	page = 1
) => {
	const url = new URL(`${TMDB_API_BASE_URL}/discover/${filter.mediaType}`);
	url.searchParams.set('include_adult', 'true');
	url.searchParams.set('language', 'en-US');
	url.searchParams.set('page', String(page));
	url.searchParams.set('sort_by', 'popularity.desc');
	if (filter.mediaType === 'movie') url.searchParams.set('include_video', 'false');
	const dateParameter =
		filter.mediaType === 'movie'
			? `primary_release_date.${criteria.yearOperator === '>=' ? 'gte' : 'lte'}`
			: `first_air_date.${criteria.yearOperator === '>=' ? 'gte' : 'lte'}`;
	url.searchParams.set(
		dateParameter,
		criteria.yearOperator === '>=' ? `${criteria.year}-01-01` : `${criteria.year}-12-31`
	);
	url.searchParams.set(
		`vote_average.${criteria.ratingOperator === '>=' ? 'gte' : 'lte'}`,
		String(criteria.rating)
	);
	if (filter.genreIds.length > 0) {
		url.searchParams.set('with_genres', [...new Set(filter.genreIds)].join(','));
	}
	if (filter.keywordIds.length > 0) {
		url.searchParams.set('with_keywords', [...new Set(filter.keywordIds)].join(','));
	}
	return url;
};

type TmdbKeywordSearch = { results?: Array<{ id?: unknown; name?: unknown }> };
type TmdbResult = {
	first_air_date?: unknown;
	genre_ids?: unknown;
	id?: unknown;
	name?: unknown;
	overview?: unknown;
	poster_path?: unknown;
	release_date?: unknown;
	title?: unknown;
	vote_average?: unknown;
};
type TmdbDiscoverPage = {
	page?: unknown;
	results?: unknown;
	total_pages?: unknown;
};

const tmdbRequest = async <Result>(url: URL, token: string, fetcher: TmdbFetcher) => {
	let response: Response;
	try {
		response = await fetcher(url, {
			headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(15_000)
		});
	} catch (error) {
		if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
			throw new ListGenerationError('TMDB took too long to respond. Please try again.', 503);
		}
		throw new ListGenerationError('TMDB could not be reached. Please try again.', 503);
	}
	if (response.status === 401 || response.status === 403) {
		throw new ListGenerationError('The TMDB API Read Access Token is missing or invalid.', 503);
	}
	if (response.status === 429) {
		throw new ListGenerationError('TMDB is receiving too many requests. Try again later.', 429);
	}
	if (!response.ok) {
		throw new ListGenerationError('TMDB is temporarily unavailable. Please try again.', 503);
	}
	try {
		return (await response.json()) as Result;
	} catch {
		throw new ListGenerationError('TMDB returned unreadable results. Please try again.', 503);
	}
};

const resolveKeywordId = async (genre: MediaGenre, token: string, fetcher: TmdbFetcher) => {
	const query = KEYWORD_QUERIES[genre];
	const url = new URL(`${TMDB_API_BASE_URL}/search/keyword`);
	url.searchParams.set('query', query);
	url.searchParams.set('page', '1');
	const response = await tmdbRequest<TmdbKeywordSearch>(url, token, fetcher);
	const matches = Array.isArray(response.results) ? response.results : [];
	const normalizedQuery = query.toLocaleLowerCase('en-US');
	const exact = matches.find(
		(result) =>
			typeof result.name === 'string' &&
			result.name.trim().toLocaleLowerCase('en-US') === normalizedQuery
	);
	const selected = exact ?? matches[0];
	return typeof selected?.id === 'number' ? selected.id : undefined;
};

const buildFilters = async (criteria: GenerationCriteria, token: string, fetcher: TmdbFetcher) => {
	const filters = await Promise.all(
		mediaTypesForCriteria(criteria.type).map(async (mediaType): Promise<TmdbFilter | undefined> => {
			const resolved = await Promise.all(
				criteria.genres.map(async (requestedGenre) => {
					const genreId = genreIdsForType(mediaType)[requestedGenre];
					if (genreId !== undefined) {
						return { kind: 'genre' as const, value: genreId };
					}
					const keywordId = await resolveKeywordId(requestedGenre, token, fetcher);
					return keywordId === undefined
						? undefined
						: { kind: 'keyword' as const, value: keywordId };
				})
			);
			if (resolved.some((value) => value === undefined)) return undefined;
			return {
				mediaType,
				requestedGenres: criteria.genres,
				genreIds: resolved.flatMap((value) => (value?.kind === 'genre' ? [value.value] : [])),
				keywordIds: resolved.flatMap((value) => (value?.kind === 'keyword' ? [value.value] : []))
			};
		})
	);
	return filters.filter((filter): filter is TmdbFilter => filter !== undefined);
};

const shuffled = <Item>(items: Item[], random: () => number) => {
	const result = [...items];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.min(index, Math.floor(random() * (index + 1)));
		[result[index], result[randomIndex]] = [result[randomIndex], result[index]];
	}
	return result;
};

const pageNumbersToSample = (totalPages: number, random: () => number) =>
	shuffled(
		Array.from({ length: Math.min(MAX_TMDB_PAGES, totalPages) }, (_, index) => index + 1),
		random
	).slice(0, TMDB_PAGES_PER_FILTER);

const validDiscoverPage = (value: TmdbDiscoverPage) => ({
	results: Array.isArray(value.results) ? (value.results as TmdbResult[]) : [],
	totalPages:
		typeof value.total_pages === 'number' && Number.isInteger(value.total_pages)
			? Math.max(0, value.total_pages)
			: 0
});

const loadFilterResults = async (
	criteria: GenerationCriteria,
	filter: TmdbFilter,
	token: string,
	fetcher: TmdbFetcher,
	random: () => number
) => {
	const firstPage = validDiscoverPage(
		await tmdbRequest<TmdbDiscoverPage>(buildTmdbDiscoverUrl(criteria, filter), token, fetcher)
	);
	if (firstPage.totalPages === 0) return [];
	const pages = pageNumbersToSample(firstPage.totalPages, random);
	const loadedPages = await Promise.all(
		pages.map((page) =>
			page === 1
				? Promise.resolve(firstPage.results)
				: tmdbRequest<TmdbDiscoverPage>(
						buildTmdbDiscoverUrl(criteria, filter, page),
						token,
						fetcher
					).then((result) => validDiscoverPage(result).results)
		)
	);
	return loadedPages.flat().map((result) => ({ result, filter }));
};

const genreNamesForIds = (mediaType: TmdbMediaType, value: unknown) => {
	if (!Array.isArray(value)) return [];
	const ids = new Set(value.filter((id): id is number => typeof id === 'number'));
	return Object.entries(genreIdsForType(mediaType))
		.filter((entry): entry is [MediaGenre, number] => entry[1] !== undefined && ids.has(entry[1]))
		.map(([genre]) => genre);
};

const yearFromDate = (value: unknown) => {
	if (typeof value !== 'string') return Number.NaN;
	const year = Number(value.slice(0, 4));
	return Number.isInteger(year) ? year : Number.NaN;
};

const mediaFromTmdb = ({ result, filter }: { result: TmdbResult; filter: TmdbFilter }) => {
	const type: MediaKind = filter.mediaType === 'movie' ? 'movie' : 'series';
	const title = filter.mediaType === 'movie' ? result.title : result.name;
	const genres = [
		...new Set([...filter.requestedGenres, ...genreNamesForIds(filter.mediaType, result.genre_ids)])
	].slice(0, 3);
	return {
		tmdbId: result.id,
		title,
		type,
		genres,
		year: yearFromDate(filter.mediaType === 'movie' ? result.release_date : result.first_air_date),
		img:
			typeof result.poster_path === 'string' ? `${TMDB_IMAGE_BASE_URL}${result.poster_path}` : '',
		imdbRating:
			typeof result.vote_average === 'number' && Number.isFinite(result.vote_average)
				? result.vote_average
				: 0,
		ratingSource: 'TMDB' as const,
		plot: truncateMediaPlot(result.overview)
	};
};

const safePosterUrl = (value: string) => {
	if (!value.trim()) return '';
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
	} catch {
		return '';
	}
};

const conditionMatches = (value: number, operator: FilterOperator, target: number) =>
	operator === '>=' ? value >= target : value <= target;

export const validateGeneratedItems = (
	rawItems: unknown,
	criteria: GenerationCriteria,
	currentYear = new Date().getFullYear()
): SourceMedia => {
	if (!Array.isArray(rawItems) || rawItems.length === 0) {
		throw new ListGenerationError(
			'TMDB found no matching titles. Try broadening the filters.',
			422
		);
	}
	const seen = new Set<string>();
	const validItems: SourceMedia = [];
	for (const rawItem of rawItems) {
		if (validItems.length >= criteria.limit) break;
		if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue;

		const record = rawItem as Record<string, unknown>;
		const tmdbId = typeof record.tmdbId === 'number' ? record.tmdbId : undefined;
		const sanitizedItem = {
			title: record.title,
			type: record.type,
			genres: record.genres,
			year: record.year,
			img: typeof record.img === 'string' ? safePosterUrl(record.img) : '',
			imdbRating:
				typeof record.imdbRating === 'number' &&
				Number.isFinite(record.imdbRating) &&
				record.imdbRating >= 0 &&
				record.imdbRating <= 10
					? record.imdbRating
					: 0,
			ratingSource: record.ratingSource === 'TMDB' ? 'TMDB' : 'IMDb',
			plot: typeof record.plot === 'string' ? record.plot : ''
		};
		const form = new FormData();
		form.set('name', 'Generated list validation');
		form.set('description', GENERATED_LIST_DESCRIPTION);
		form.set('items', JSON.stringify([sanitizedItem]));
		const validated = validateMovieListForm(form);
		if (!validated.ok) continue;

		const item = validated.items[0];
		if (criteria.type !== 'both' && item.type !== criteria.type) continue;
		if (!conditionMatches(item.year, criteria.yearOperator, criteria.year)) continue;
		if (item.year > currentYear) continue;
		const genres = validateMediaGenres(item.genres);
		if (!genres.valid || !criteria.genres.every((genre) => genres.genres.includes(genre))) continue;
		if (
			item.imdbRating !== 0 &&
			!conditionMatches(item.imdbRating, criteria.ratingOperator, criteria.rating)
		) {
			continue;
		}
		const duplicateKey =
			tmdbId === undefined
				? `${item.type}:${item.title.trim().toLocaleLowerCase('en-US')}:${item.year}`
				: `${item.type}:tmdb:${tmdbId}`;
		if (seen.has(duplicateKey)) continue;
		seen.add(duplicateKey);
		validItems.push(item);
	}

	if (validItems.length === 0) {
		throw new ListGenerationError(
			'TMDB found no matching titles. Try broadening the filters.',
			422
		);
	}
	return validItems;
};

export const generateItemsFromTmdb = async (
	criteria: GenerationCriteria,
	token: string,
	fetcher: TmdbFetcher = fetch,
	random: () => number = Math.random,
	currentYear = new Date().getFullYear()
) => {
	if (!token.trim()) {
		throw new ListGenerationError('TMDB generation is not configured yet.', 503);
	}
	const filters = await buildFilters(criteria, token, fetcher);
	if (filters.length === 0) {
		throw new ListGenerationError('TMDB found no matching titles. Try other genres.', 422);
	}
	const resultGroups = await Promise.all(
		filters.map((filter) => loadFilterResults(criteria, filter, token, fetcher, random))
	);
	const candidates = shuffled(resultGroups.flat().map(mediaFromTmdb), random);
	return validateGeneratedItems(candidates, criteria, currentYear);
};

const namePrefix = (criteria: GenerationCriteria) => {
	const genre = criteria.genres.join(' + ');
	const kind =
		criteria.type === 'movie' ? 'movies' : criteria.type === 'series' ? 'series' : 'picks';
	return `Generated ${genre} ${kind}`;
};

export const makeGeneratedListName = (
	criteria: GenerationCriteria,
	randomId = crypto.randomUUID()
) =>
	`${namePrefix(criteria)} · ${randomId.replaceAll('-', '').slice(0, 6).toUpperCase()}`.slice(
		0,
		80
	);

export type GeneratedList = {
	name: string;
	description: string;
	items: SourceMedia;
	itemsJson: Json;
};

export const generateListFromTmdb = async (
	criteria: GenerationCriteria,
	token: string,
	fetcher?: TmdbFetcher,
	random?: () => number
): Promise<GeneratedList> => {
	const items = await generateItemsFromTmdb(criteria, token, fetcher, random);
	return {
		name: makeGeneratedListName(criteria),
		description: GENERATED_LIST_DESCRIPTION,
		items,
		itemsJson: items as Json
	};
};
