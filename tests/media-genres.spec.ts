import { describe, expect, it } from 'vitest';
import {
	applyGenreSuggestion,
	genreSuggestions,
	MEDIA_GENRES,
	validateGenreInput,
	validateMediaGenres
} from '$lib/media-genres';

describe('media genre validation', () => {
	it('uses the canonical IMDb genre names', () => {
		expect(MEDIA_GENRES).toContain('Drama');
		expect(MEDIA_GENRES).toContain('Film-Noir');
		expect(MEDIA_GENRES).toContain('Reality-TV');
		expect(MEDIA_GENRES).toContain('Sci-Fi');
	});

	it('normalizes capitalization and common spacing variants', () => {
		expect(validateGenreInput(' drama, sci fi, Film Noir')).toEqual({
			valid: true,
			genres: ['Drama', 'Sci-Fi', 'Film-Noir'],
			message: ''
		});
	});

	it.each([
		['', 'At least one genre is required.'],
		['Drama, Comedy, Mystery, Thriller', 'Choose no more than 3 genres.'],
		['Drama, Made Up', 'Unknown genre: Made Up.'],
		['Drama, drama', 'Remove the duplicate genre “Drama”.'],
		['Drama,,Comedy', 'Genre names cannot be empty. Separate each genre with one comma.']
	])('rejects invalid comma-separated genres %#', (value, message) => {
		expect(validateGenreInput(value)).toEqual({ valid: false, genres: [], message });
	});

	it('rejects non-string genre values submitted outside the editor', () => {
		expect(validateMediaGenres(['Drama', 7])).toEqual({
			valid: false,
			genres: [],
			message: 'Every genre must be a name.'
		});
	});

	it('filters suggestions using the current comma-separated segment', () => {
		expect(genreSuggestions('Drama, sci')).toEqual(['Sci-Fi']);
		expect(genreSuggestions('Drama, Sci-Fi')).not.toContain('Drama');
		expect(genreSuggestions('Drama, Sci-Fi')).not.toContain('Sci-Fi');
		expect(genreSuggestions('Drama, Sci-Fi')).toContain('Comedy');
	});

	it('appends selected suggestions in canonical comma-separated form', () => {
		expect(applyGenreSuggestion('dra', 'Drama')).toBe('Drama');
		expect(applyGenreSuggestion('Drama', 'Sci-Fi')).toBe('Drama, Sci-Fi');
		expect(applyGenreSuggestion('Drama, sci', 'Sci-Fi')).toBe('Drama, Sci-Fi');
		expect(applyGenreSuggestion('Drama, Sci-Fi', 'Comedy')).toBe('Drama, Sci-Fi, Comedy');
	});

	it('stops suggesting values after three genres are selected', () => {
		expect(genreSuggestions('Drama, Sci-Fi, Comedy')).toEqual([]);
		expect(applyGenreSuggestion('Drama, Sci-Fi, Comedy', 'Action')).toBe('Drama, Sci-Fi, Comedy');
	});
});
