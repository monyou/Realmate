export const MAX_MEDIA_PLOT_LENGTH = 360;

export const normalizeMediaPlot = (plot: string) => plot.trim();

export const truncateMediaPlot = (value: unknown) => {
	if (typeof value !== 'string') return '';
	const plot = value.replace(/\s+/g, ' ').trim();
	if (plot.length <= MAX_MEDIA_PLOT_LENGTH) return plot;

	const available = plot.slice(0, MAX_MEDIA_PLOT_LENGTH - 1);
	const wordBoundary = available.lastIndexOf(' ');
	const truncated =
		wordBoundary >= MAX_MEDIA_PLOT_LENGTH * 0.7 ? available.slice(0, wordBoundary) : available;
	return `${truncated.trimEnd()}…`;
};
