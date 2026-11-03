<script lang="ts">
	import { asset } from '$app/paths';
	import { MEDIA_GENRES } from '#lib/media-genres.js';
	import { MAX_MEDIA_PLOT_LENGTH } from '#lib/media-plot.js';
	import {
		MAX_IMPORT_BYTES,
		MAX_LIST_TITLES,
		parseMovieListImport,
		type ImportedTitle
	} from '#lib/movie-list-import.js';

	let {
		titleCount,
		disabled = false,
		reading = $bindable(false),
		onimport
	}: {
		titleCount: number;
		disabled?: boolean;
		reading?: boolean;
		onimport: (titles: ImportedTitle[]) => void;
	} = $props();
	let error = $state('');
	let status = $state('');

	const importFile = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || reading || disabled) return;
		reading = true;
		error = '';
		status = '';
		try {
			if (!file.name.toLowerCase().endsWith('.json')) {
				throw new Error('Choose a .json file. Download the example to get started.');
			}
			if (file.size > MAX_IMPORT_BYTES) {
				throw new Error('This file is too large. Choose a JSON file up to 5 MB.');
			}
			const titles = parseMovieListImport(await file.text(), titleCount);
			onimport(titles);
			status = `Added ${titles.length} ${titles.length === 1 ? 'title' : 'titles'} from ${file.name}. Review them below before creating your list.`;
		} catch (cause) {
			error =
				cause instanceof Error
					? cause.message
					: 'The file could not be read. Choose it again or try another file.';
		} finally {
			reading = false;
			input.value = '';
		}
	};
</script>

<section aria-label="Import titles from JSON" class="border-y border-white/9 py-5">
	<div
		class="flex flex-col gap-4 min-[600px]:flex-row min-[600px]:items-center min-[600px]:justify-between"
	>
		<div>
			<h2 class="text-sm font-bold text-white">Already have a collection?</h2>
			<p id="json-import-help" class="mt-1 text-xs leading-relaxed text-(--muted)">
				Add titles from a JSON file. Your current draft stays in place.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<label
				class="relative inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-(--purple)/40 bg-(--purple)/10 px-4 text-sm font-bold text-[#c8beff] transition focus-within:outline-3 focus-within:outline-offset-4 focus-within:outline-(--gold) hover:bg-(--purple)/20 has-disabled:opacity-50"
			>
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					class="size-4"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"></path></svg
				>
				{reading ? 'Reading file…' : 'Import JSON'}
				<input
					type="file"
					accept=".json,application/json"
					aria-label="Import JSON"
					aria-describedby="json-import-help"
					disabled={disabled || reading}
					onchange={importFile}
					class="absolute inset-0 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
				/>
			</label>
			<a
				href={asset('examples/watch-list.json')}
				download="realmate-watch-list.json"
				class="inline-flex min-h-11 items-center text-xs font-bold text-(--muted) underline decoration-white/25 underline-offset-4 hover:text-white focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-(--gold)"
				>Download example</a
			>
		</div>
	</div>
	<details class="mt-3 text-xs text-(--muted)">
		<summary class="w-fit cursor-pointer py-2 font-bold text-[#d8d2e2]">File format</summary>
		<div class="mt-2 space-y-3 leading-relaxed wrap-anywhere">
			<p>
				Use an array of title objects. Enter the list name and description above. Up to {MAX_LIST_TITLES}
				titles per list; files up to 5 MB.
			</p>
			<pre class="overflow-x-auto rounded-xl bg-black/25 p-4 text-[11px] text-[#d8d2e2]"><code
					>{JSON.stringify(
						[{ title: 'Arrival', type: 'movie', genres: ['Drama', 'Sci-Fi'], year: 2016 }],
						null,
						2
					)}</code
				></pre>
			<p>
				<strong class="text-[#d8d2e2]">Required:</strong> <code>title</code> (non-empty text, up to
				160 characters), <code>type</code> (<code>movie</code> or <code>series</code>),
				<code>genres</code>
				(1–3 unique names), and <code>year</code> (a whole number from 1888 to 2100).
			</p>
			<p>
				<strong class="text-[#d8d2e2]">Optional:</strong> <code>img</code> (HTTP/HTTPS poster URL),
				<code>imdbRating</code>
				(number from 0 to 10; 0 means unknown), <code>ratingSource</code> (<code>IMDb</code> or
				<code>TMDB</code>, defaults to IMDb), and <code>plot</code> (up to {MAX_MEDIA_PLOT_LENGTH} characters).
			</p>
			<p><strong class="text-[#d8d2e2]">Supported genres:</strong> {MEDIA_GENRES.join(', ')}.</p>
			<p>
				Use only these fields. Titles needing correction open for editing after import. Nothing is
				saved until you choose Create list.
			</p>
		</div>
	</details>
	{#if error}<p role="alert" class="mt-3 text-sm leading-relaxed wrap-anywhere text-[#ff9aac]">
			{error}
		</p>{/if}
	<p
		role="status"
		class="text-sm leading-relaxed wrap-anywhere text-(--mint) {status ? 'mt-3' : ''}"
	>
		{status}
	</p>
</section>
