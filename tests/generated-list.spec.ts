import type { GenerationCriteria } from '$lib/generated-list';
import {
	TMDB_IMAGE_BASE_URL,
	buildTmdbDiscoverUrl,
	generateItemsFromTmdb,
	makeGeneratedListName,
	validateGeneratedItems,
	validateGenerationCriteria
} from '$lib/server/generated-list';
import { describe, expect, it, vi } from 'vitest';

const criteria: GenerationCriteria = {
	type: 'movie',
	yearOperator: '>=',
	year: 2010,
	genres: ['Drama', 'Sci-Fi'],
	ratingOperator: '>=',
	rating: 7,
	limit: 2
};

const makeCriteriaForm = () => {
	const form = new FormData();
	form.set('type', 'both');
	form.set('yearOperator', '>=');
	form.set('year', '2000');
	form.append('genres', 'Comedy');
	form.append('genres', 'Drama');
	form.set('ratingOperator', '>=');
	form.set('rating', '7.2');
	form.set('limit', '12');
	return form;
};

const jsonResponse = (value: unknown) =>
	new Response(JSON.stringify(value), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});

describe('generated list criteria', () => {
	it('normalizes a complete criteria form', () => {
		const result = validateGenerationCriteria(makeCriteriaForm(), 2026);

		expect(result).toEqual({
			ok: true,
			values: {
				type: 'both',
				yearOperator: '>=',
				year: '2000',
				genres: ['Comedy', 'Drama'],
				ratingOperator: '>=',
				rating: '7.2',
				limit: '12'
			},
			criteria: {
				type: 'both',
				yearOperator: '>=',
				year: 2000,
				genres: ['Comedy', 'Drama'],
				ratingOperator: '>=',
				rating: 7.2,
				limit: 12
			}
		});
	});

	it('rejects duplicate, removed, and impossible client values on the server', () => {
		const duplicateGenres = makeCriteriaForm();
		duplicateGenres.append('genres', 'Comedy');
		expect(validateGenerationCriteria(duplicateGenres, 2026)).toMatchObject({
			ok: false,
			message: 'Choose each genre only once.'
		});

		const removedGenre = makeCriteriaForm();
		removedGenre.set('genres', 'Adult');
		expect(validateGenerationCriteria(removedGenre, 2026)).toMatchObject({
			ok: false,
			message: 'Unknown genre: Adult.'
		});

		const futureYear = makeCriteriaForm();
		futureYear.set('year', '2027');
		expect(validateGenerationCriteria(futureYear, 2026)).toMatchObject({
			ok: false,
			message: 'Year must be a whole number from 1888 to 2026.'
		});
	});
});

describe('TMDB discovery generation', () => {
	it('maps movie and series criteria to TMDB discover parameters', () => {
		const movieUrl = buildTmdbDiscoverUrl(
			criteria,
			{
				mediaType: 'movie',
				requestedGenres: ['Drama', 'Sci-Fi'],
				genreIds: [18, 878],
				keywordIds: []
			},
			17
		);
		expect(movieUrl.origin + movieUrl.pathname).toBe('https://api.themoviedb.org/3/discover/movie');
		expect(Object.fromEntries(movieUrl.searchParams)).toMatchObject({
			include_adult: 'true',
			include_video: 'false',
			'primary_release_date.gte': '2010-01-01',
			'vote_average.gte': '7',
			with_genres: '18,878',
			page: '17'
		});

		const seriesUrl = buildTmdbDiscoverUrl(
			{
				...criteria,
				type: 'series',
				yearOperator: '<=',
				year: 2020,
				ratingOperator: '<=',
				rating: 8
			},
			{
				mediaType: 'tv',
				requestedGenres: ['Drama', 'Sci-Fi'],
				genreIds: [18],
				keywordIds: [42]
			}
		);
		expect(seriesUrl.pathname).toBe('/3/discover/tv');
		expect(seriesUrl.searchParams.get('first_air_date.lte')).toBe('2020-12-31');
		expect(seriesUrl.searchParams.get('vote_average.lte')).toBe('8');
		expect(seriesUrl.searchParams.get('with_genres')).toBe('18');
		expect(seriesUrl.searchParams.get('with_keywords')).toBe('42');
	});

	it('combines selected genres with AND logic and returns a partial non-empty result', async () => {
		const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			expect(init?.headers).toMatchObject({ Authorization: 'Bearer read-token' });
			const url = new URL(input instanceof Request ? input.url : input);
			expect(url.searchParams.get('with_genres')).toBe('18,878');
			return jsonResponse({
				page: 1,
				total_pages: 1,
				results: [
					{
						id: 329865,
						title: 'Arrival',
						release_date: '2016-11-10',
						genre_ids: [18, 878],
						poster_path: '/arrival.jpg',
						vote_average: 7.6
					},
					{
						id: 157336,
						title: 'Interstellar',
						release_date: '2014-11-05',
						genre_ids: [12, 18, 878],
						poster_path: null,
						vote_average: 8.5
					}
				]
			});
		});

		const result = await generateItemsFromTmdb(
			{ ...criteria, limit: 5 },
			'read-token',
			fetcher,
			() => 0.5,
			2026
		);

		expect(result).toHaveLength(2);
		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					title: 'Arrival',
					img: `${TMDB_IMAGE_BASE_URL}/arrival.jpg`,
					ratingSource: 'TMDB'
				}),
				expect.objectContaining({ title: 'Interstellar', img: '', ratingSource: 'TMDB' })
			])
		);
		expect(
			result.every((item) => criteria.genres.every((genre) => item.genres.includes(genre)))
		).toBe(true);
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it('ANDs a keyword fallback with native TMDB genres', async () => {
		const biographyCriteria: GenerationCriteria = {
			...criteria,
			genres: ['Drama', 'Biography'],
			limit: 1
		};
		const fetcher = vi.fn(async (input: string | URL | Request) => {
			const url = new URL(input instanceof Request ? input.url : input);
			if (url.pathname.endsWith('/search/keyword')) {
				return jsonResponse({ results: [{ id: 5565, name: 'biography' }] });
			}
			expect(url.searchParams.get('with_genres')).toBe('18');
			expect(url.searchParams.get('with_keywords')).toBe('5565');
			return jsonResponse({
				page: 1,
				total_pages: 1,
				results: [
					{
						id: 1,
						title: 'A Life Story',
						release_date: '2018-01-01',
						genre_ids: [18],
						vote_average: 7.4
					}
				]
			});
		});

		const result = await generateItemsFromTmdb(
			biographyCriteria,
			'read-token',
			fetcher,
			() => 0.5,
			2026
		);

		expect(result[0]).toMatchObject({ genres: ['Drama', 'Biography'] });
	});

	it('keeps valid matches while dropping invalid, duplicate, and future titles', () => {
		const arrival = {
			tmdbId: 329865,
			title: 'Arrival',
			type: 'movie',
			genres: ['Drama', 'Sci-Fi'],
			year: 2016,
			img: '',
			imdbRating: 7.6,
			ratingSource: 'TMDB'
		};
		const result = validateGeneratedItems(
			[
				arrival,
				{ ...arrival, tmdbId: 2, title: 'Wrong genre', genres: ['Comedy'] },
				{ ...arrival, tmdbId: 3, title: 'Low rating', imdbRating: 6.9 },
				arrival,
				{ ...arrival, tmdbId: 4, title: 'Future title', year: 2027 },
				{
					...arrival,
					tmdbId: 157336,
					title: 'Interstellar',
					year: 2014,
					genres: ['Drama', 'Sci-Fi', 'Adventure'],
					imdbRating: 8.5
				}
			],
			criteria,
			2026
		);

		expect(result.map((item) => item.title)).toEqual(['Arrival', 'Interstellar']);
	});

	it('returns useful errors when configuration or results are missing', async () => {
		await expect(generateItemsFromTmdb(criteria, '')).rejects.toThrow(
			'TMDB generation is not configured yet.'
		);
		expect(() => validateGeneratedItems([], criteria)).toThrow('TMDB found no matching titles');
	});

	it('creates meaningful unique names that fit the database limit', () => {
		const name = makeGeneratedListName(criteria, '12345678-aaaa-bbbb-cccc-123456789012');
		expect(name).toBe('Generated Drama + Sci-Fi movies · 123456');
		expect(name.length).toBeLessThanOrEqual(80);
	});
});
