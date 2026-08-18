import type { MediaGenre } from '$lib/media-genres';
import type { MediaKind } from '$lib/types';

export const MAX_GENERATED_RESULTS = 30;
export const MAX_FILTER_GENRES = 3;

export type FilterOperator = '>=' | '<=';
export type GeneratedMediaType = MediaKind | 'both';

export type GenerationCriteriaValues = {
	type: string;
	yearOperator: string;
	year: string;
	genres: string[];
	ratingOperator: string;
	rating: string;
	limit: string;
};

export type GenerationCriteria = {
	type: GeneratedMediaType;
	yearOperator: FilterOperator;
	year: number;
	genres: MediaGenre[];
	ratingOperator: FilterOperator;
	rating: number;
	limit: number;
};
