<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import RealmateLogo from '$lib/components/RealmateLogo.svelte';
	import {
		MAX_FILTER_GENRES,
		MAX_GENERATED_RESULTS,
		type FilterOperator,
		type GeneratedMediaType
	} from '$lib/generated-list';
	import { MEDIA_GENRES, type MediaGenre } from '$lib/media-genres';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const currentYear = new Date().getFullYear();
	const restoredValues = () => form?.values;
	const restoredGenres = () =>
		(restoredValues()?.genres ?? []).filter((genre): genre is MediaGenre =>
			MEDIA_GENRES.includes(genre as MediaGenre)
		);
	const restoredType = () => {
		const savedType = restoredValues()?.type;
		return savedType === 'movie' || savedType === 'series' || savedType === 'both'
			? savedType
			: 'both';
	};
	const savedGenres = restoredGenres();

	let type = $state<GeneratedMediaType>(restoredType());
	let yearOperator = $state<FilterOperator>(restoredValues()?.yearOperator === '<=' ? '<=' : '>=');
	let year = $state(Number(restoredValues()?.year || 2000));
	let selectedGenres = $state<MediaGenre[]>(savedGenres.length > 0 ? savedGenres : ['Comedy']);
	let ratingOperator = $state<FilterOperator>(
		restoredValues()?.ratingOperator === '<=' ? '<=' : '>='
	);
	let rating = $state(Number(restoredValues()?.rating || 7));
	let limit = $state(Number(restoredValues()?.limit || 12));
	let submitting = $state(false);
	let touched = $state({ year: false, genres: false, rating: false, limit: false });

	const validType = $derived(type === 'movie' || type === 'series' || type === 'both');
	const validYear = $derived(Number.isInteger(year) && year >= 1888 && year <= currentYear);
	const validGenres = $derived(
		selectedGenres.length >= 1 && selectedGenres.length <= MAX_FILTER_GENRES
	);
	const validRating = $derived(Number.isFinite(rating) && rating >= 0 && rating <= 10);
	const validLimit = $derived(
		Number.isInteger(limit) && limit >= 1 && limit <= MAX_GENERATED_RESULTS
	);
	const formIsValid = $derived(validType && validYear && validGenres && validRating && validLimit);

	const typeLabel = $derived(
		type === 'movie' ? 'Movies' : type === 'series' ? 'Series' : 'Movies & series'
	);
	const yearLabel = $derived(yearOperator === '>=' ? `From ${year}` : `Up to ${year}`);
	const ratingLabel = $derived(
		ratingOperator === '>=' ? `TMDB ${rating}+` : `TMDB ${rating} or lower`
	);
	const criteriaSummary = $derived(
		`${typeLabel} · ${yearLabel} · ${selectedGenres.join(' + ') || 'Choose a genre'} · ${ratingLabel} · Up to ${limit}`
	);

	const toggleGenre = (genre: MediaGenre) => {
		touched.genres = true;
		if (selectedGenres.includes(genre)) {
			selectedGenres = selectedGenres.filter((selected) => selected !== genre);
			return;
		}
		if (selectedGenres.length < MAX_FILTER_GENRES) selectedGenres = [...selectedGenres, genre];
	};

	const handleSubmit: SubmitFunction = ({ cancel }) => {
		touched = { year: true, genres: true, rating: true, limit: true };
		if (!formIsValid) {
			cancel();
			queueMicrotask(() => {
				if (!validYear) document.querySelector<HTMLElement>('#year')?.focus();
				else if (!validGenres)
					document.querySelector<HTMLElement>('#genre-options button')?.focus();
				else if (!validRating) document.querySelector<HTMLElement>('#rating')?.focus();
				else if (!validLimit) document.querySelector<HTMLElement>('#limit')?.focus();
			});
			return;
		}

		submitting = true;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				submitting = false;
			}
		};
	};
</script>

<svelte:head>
	<title>Generate a watch list — Realmate</title>
	<meta
		name="description"
		content="Choose movie and series criteria and generate a random Realmate watch list from TMDB results."
	/>
</svelte:head>

<div class="relative isolate min-h-dvh overflow-hidden bg-[#0b0910] text-(--ink)">
	<div
		class="pointer-events-none fixed -top-60 -left-44 -z-1 size-160 rounded-full bg-[#7c5cff]/20 blur-[120px]"
	></div>
	<div
		class="pointer-events-none fixed top-1/3 -right-56 -z-1 size-140 rounded-full bg-[#42e8c1]/8 blur-[130px]"
	></div>
	<header class="border-b border-white/7 px-5 py-5 backdrop-blur-xl">
		<div class="mx-auto flex w-[min(100%,1040px)] items-center justify-between">
			<RealmateLogo />
			<a
				href={resolve('/profile')}
				class="text-xs font-bold text-(--muted) no-underline transition hover:text-white"
				>← Back to lists</a
			>
		</div>
	</header>

	<main class="mx-auto w-[min(100%,1040px)] px-5 py-10 min-[760px]:py-14">
		<div class="grid items-end gap-8 min-[820px]:grid-cols-[minmax(0,1fr)_300px]">
			<div>
				<div
					class="mb-4 inline-flex items-center gap-2 rounded-full border border-(--purple)/25 bg-(--purple)/10 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.14em] text-[#b8aaff] uppercase"
				>
					<span class="size-1.5 rounded-full bg-(--mint) shadow-[0_0_10px_#42e8c1]"></span>
					TMDB list studio
				</div>
				<h1 class="m-0 text-[clamp(42px,7vw,68px)] leading-[0.95] font-[850] tracking-[-0.065em]">
					Set the vibe.<br /><span
						class="bg-[linear-gradient(100deg,#ff7388,#a893ff)] bg-clip-text text-transparent"
						>Get the list.</span
					>
				</h1>
				<p class="mt-5 max-w-160 text-sm leading-relaxed text-(--muted)">
					Choose your filters and Realmate will pick a random ready-to-swipe collection from
					matching TMDB results.
				</p>
			</div>
			<aside
				class="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(124,92,255,.14),rgba(255,255,255,.025))] p-5"
			>
				<p class="text-[10px] font-extrabold tracking-[0.14em] text-(--mint) uppercase">
					Your recipe
				</p>
				<p class="mt-3 text-sm leading-relaxed font-bold text-[#e7e1ef]">{criteriaSummary}</p>
			</aside>
		</div>

		{#if form?.message}
			<div
				class="mt-8 flex items-start gap-3 rounded-2xl border border-[#ff5c74]/25 bg-[#ff5c74]/8 px-4 py-3.5 text-sm text-[#ff9aac]"
				role="alert"
			>
				<span aria-hidden="true">!</span><span>{form.message}</span>
			</div>
		{/if}

		<form method="POST" class="mt-9 space-y-6" novalidate use:enhance={handleSubmit}>
			{#each selectedGenres as genre (genre)}
				<input type="hidden" name="genres" value={genre} />
			{/each}

			<section
				class="rounded-[28px] border border-white/9 bg-[linear-gradient(145deg,rgba(29,25,39,.92),rgba(15,13,20,.97))] p-5 shadow-[0_22px_70px_rgba(0,0,0,.24)] min-[700px]:p-7"
			>
				<div class="flex items-start gap-4">
					<span
						class="grid size-9 flex-none place-items-center rounded-xl bg-(--purple)/14 text-xs font-black text-[#b8aaff]"
						>01</span
					>
					<div>
						<h2 class="text-lg font-extrabold tracking-[-0.03em]">What are we watching?</h2>
						<p class="mt-1 text-xs text-(--muted)">Choose one format or leave the door open.</p>
					</div>
				</div>
				<fieldset class="mt-6 grid gap-3 border-0 p-0 min-[620px]:grid-cols-3">
					<legend class="sr-only">Media type</legend>
					{#each [{ value: 'movie', label: 'Movies', hint: 'Feature films' }, { value: 'series', label: 'Series', hint: 'TV series' }, { value: 'both', label: 'Both', hint: 'Mix it up' }] as option (option.value)}
						<label
							class="relative cursor-pointer rounded-2xl border p-4 transition {type ===
							option.value
								? 'border-(--purple)/60 bg-(--purple)/13 shadow-[inset_0_0_0_1px_rgba(124,92,255,.15)]'
								: 'border-white/9 bg-white/3 hover:border-white/18 hover:bg-white/5'}"
						>
							<input
								type="radio"
								name="type"
								value={option.value}
								bind:group={type}
								class="sr-only"
							/>
							<strong class="block text-sm text-white">{option.label}</strong>
							<small class="mt-1 block text-[10px] text-(--muted)">{option.hint}</small>
							<span
								class="absolute top-4 right-4 grid size-4 place-items-center rounded-full border {type ===
								option.value
									? 'border-(--purple) bg-(--purple)'
									: 'border-white/20'}"
							>
								{#if type === option.value}<span class="size-1.5 rounded-full bg-white"></span>{/if}
							</span>
						</label>
					{/each}
				</fieldset>
			</section>

			<section
				class="rounded-[28px] border border-white/9 bg-[linear-gradient(145deg,rgba(29,25,39,.92),rgba(15,13,20,.97))] p-5 shadow-[0_22px_70px_rgba(0,0,0,.24)] min-[700px]:p-7"
			>
				<div class="flex items-start gap-4">
					<span
						class="grid size-9 flex-none place-items-center rounded-xl bg-(--rose)/12 text-xs font-black text-[#ff8ca0]"
						>02</span
					>
					<div>
						<h2 class="text-lg font-extrabold tracking-[-0.03em]">Pick an era</h2>
						<p class="mt-1 text-xs text-(--muted)">Set a hard release or premiere-year boundary.</p>
					</div>
				</div>
				<div class="mt-6 grid gap-4 min-[620px]:grid-cols-[220px_1fr]">
					<fieldset class="grid grid-cols-2 rounded-2xl border border-white/9 bg-black/20 p-1">
						<legend class="sr-only">Year operator</legend>
						{#each [{ value: '>=', label: 'From' }, { value: '<=', label: 'Up to' }] as option (option.value)}
							<label
								class="cursor-pointer rounded-xl px-3 py-3 text-center text-xs font-extrabold transition {yearOperator ===
								option.value
									? 'bg-white/10 text-white'
									: 'text-(--muted) hover:text-white'}"
							>
								<input
									type="radio"
									name="yearOperator"
									value={option.value}
									bind:group={yearOperator}
									class="sr-only"
								/>{option.label}</label
							>
						{/each}
					</fieldset>
					<div>
						<label for="year" class="sr-only">Year</label>
						<input
							id="year"
							name="year"
							type="number"
							min="1888"
							max={currentYear}
							step="1"
							bind:value={year}
							onblur={() => (touched.year = true)}
							aria-invalid={touched.year && !validYear}
							aria-describedby={touched.year && !validYear ? 'year-error' : undefined}
							class="box-border h-full min-h-13 w-full rounded-2xl border bg-black/20 px-4 text-lg font-extrabold text-white outline-none focus:border-(--purple) {touched.year &&
							!validYear
								? 'border-[#ff5c74]/60'
								: 'border-white/10'}"
						/>
						{#if touched.year && !validYear}
							<small id="year-error" class="mt-1.5 block text-[10px] text-[#ff8ca0]"
								>Enter a whole year from 1888 to {currentYear}.</small
							>
						{/if}
					</div>
				</div>
			</section>

			<section
				class="rounded-[28px] border border-white/9 bg-[linear-gradient(145deg,rgba(29,25,39,.92),rgba(15,13,20,.97))] p-5 shadow-[0_22px_70px_rgba(0,0,0,.24)] min-[700px]:p-7"
			>
				<div class="flex items-start justify-between gap-4">
					<div class="flex items-start gap-4">
						<span
							class="grid size-9 flex-none place-items-center rounded-xl bg-(--mint)/10 text-xs font-black text-(--mint)"
							>03</span
						>
						<div>
							<h2 class="text-lg font-extrabold tracking-[-0.03em]">Choose the mood</h2>
							<p class="mt-1 text-xs text-(--muted)">A title must match every selected genre.</p>
						</div>
					</div>
					<span class="flex-none text-[10px] font-bold text-(--muted)"
						>{selectedGenres.length}/{MAX_FILTER_GENRES}</span
					>
				</div>
				<div id="genre-options" class="mt-6 flex flex-wrap gap-2" role="group" aria-label="Genres">
					{#each MEDIA_GENRES as genre (genre)}
						<button
							type="button"
							onclick={() => toggleGenre(genre)}
							aria-pressed={selectedGenres.includes(genre)}
							disabled={!selectedGenres.includes(genre) &&
								selectedGenres.length >= MAX_FILTER_GENRES}
							class="cursor-pointer rounded-full border px-3 py-2 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-35 {selectedGenres.includes(
								genre
							)
								? 'border-(--mint)/45 bg-(--mint)/12 text-[#87f5db]'
								: 'border-white/9 bg-white/3 text-(--muted) hover:border-white/18 hover:text-white'}"
						>
							{selectedGenres.includes(genre) ? '✓ ' : ''}{genre}
						</button>
					{/each}
				</div>
				{#if touched.genres && !validGenres}
					<small class="mt-3 block text-[10px] text-[#ff8ca0]">Choose at least one genre.</small>
				{:else}
					<small class="mt-3 block text-[10px] text-(--muted)"
						>Choose up to {MAX_FILTER_GENRES}. More genres create a narrower match.</small
					>
				{/if}
			</section>

			<section
				class="grid gap-6 rounded-[28px] border border-white/9 bg-[linear-gradient(145deg,rgba(29,25,39,.92),rgba(15,13,20,.97))] p-5 shadow-[0_22px_70px_rgba(0,0,0,.24)] min-[700px]:grid-cols-2 min-[700px]:p-7"
			>
				<div>
					<div class="flex items-start gap-4">
						<span
							class="grid size-9 flex-none place-items-center rounded-xl bg-(--gold)/10 text-xs font-black text-(--gold)"
							>04</span
						>
						<div>
							<h2 class="text-lg font-extrabold tracking-[-0.03em]">Set the quality bar</h2>
							<p class="mt-1 text-xs text-(--muted)">
								Filter TMDB community ratings. Titles with an unknown rating may still be included.
							</p>
						</div>
					</div>
					<div class="mt-6 grid grid-cols-[150px_1fr] gap-3">
						<select
							name="ratingOperator"
							bind:value={ratingOperator}
							aria-label="Rating condition"
							class="rounded-2xl border border-white/10 bg-[#14111a] px-3 text-xs font-bold text-white outline-none focus:border-(--purple)"
						>
							<option value=">=">At least</option>
							<option value="<=">At most</option>
						</select>
						<div>
							<label for="rating" class="sr-only">TMDB rating</label>
							<input
								id="rating"
								name="rating"
								type="number"
								min="0"
								max="10"
								step="0.1"
								bind:value={rating}
								onblur={() => (touched.rating = true)}
								aria-invalid={touched.rating && !validRating}
								aria-describedby={touched.rating && !validRating ? 'rating-error' : undefined}
								class="box-border w-full rounded-2xl border bg-black/20 px-4 py-3.5 text-sm font-extrabold text-white outline-none focus:border-(--purple) {touched.rating &&
								!validRating
									? 'border-[#ff5c74]/60'
									: 'border-white/10'}"
							/>
						</div>
					</div>
					{#if touched.rating && !validRating}
						<small id="rating-error" class="mt-2 block text-[10px] text-[#ff8ca0]"
							>Enter a rating from 0 to 10.</small
						>
					{/if}
				</div>

				<div class="border-white/8 min-[700px]:border-l min-[700px]:pl-7">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-[10px] font-extrabold tracking-[0.14em] text-(--rose) uppercase">
								List size
							</p>
							<h2 class="mt-1 text-lg font-extrabold tracking-[-0.03em]">How many picks?</h2>
						</div>
						<span
							class="grid min-w-12 place-items-center rounded-xl border border-(--purple)/25 bg-(--purple)/12 px-3 py-2 text-lg font-black text-[#c1b5ff]"
							>{limit}</span
						>
					</div>
					<label for="limit" class="sr-only">Maximum number of results</label>
					<input
						id="limit"
						name="limit"
						type="range"
						min="1"
						max={MAX_GENERATED_RESULTS}
						step="1"
						bind:value={limit}
						oninput={() => (touched.limit = true)}
						aria-invalid={touched.limit && !validLimit}
						class="mt-7 w-full cursor-pointer accent-[#7c5cff]"
					/>
					<div class="mt-1 flex justify-between text-[9px] font-bold text-(--muted)">
						<span>1</span><span>{MAX_GENERATED_RESULTS}</span>
					</div>
				</div>
			</section>

			<div
				class="flex flex-col items-stretch justify-between gap-5 rounded-[26px] border border-(--purple)/20 bg-[linear-gradient(115deg,rgba(124,92,255,.13),rgba(255,92,116,.08))] p-5 min-[700px]:flex-row min-[700px]:items-center min-[700px]:p-6"
			>
				<div class="max-w-150">
					<p class="text-xs font-extrabold text-white">Ready to roll</p>
					<p class="mt-1 text-[11px] leading-relaxed text-(--muted)">
						Every title must contain all selected genres. If fewer matches exist than requested,
						Realmate saves the valid titles it found.
					</p>
				</div>
				<button
					type="submit"
					disabled={submitting}
					class="inline-flex min-w-47 cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-[linear-gradient(110deg,#9c83ff,#ff6d84)] px-6 py-4 text-sm font-extrabold text-[#130c19] shadow-[0_14px_34px_rgba(124,92,255,.25)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-65"
				>
					<span aria-hidden="true">✦</span> Generate list
				</button>
			</div>
		</form>
	</main>
</div>

<LoadingOverlay visible={submitting} label="Finding random TMDB titles…" />
