<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import ReelmateLogo from '$lib/components/ReelmateLogo.svelte';

	type DraftItem = {
		key: string;
		title: string;
		type: '' | 'movie' | 'series';
		genres: string;
		img: string;
		year: number | undefined;
		imdbRating: number | undefined;
		expanded: boolean;
		showErrors: boolean;
	};

	type EditorActionData = {
		message?: string;
		values?: {
			name?: string;
			description?: string;
			itemsJson?: string;
		};
	} | null;

	type Props = {
		mode: 'create' | 'edit';
		form?: EditorActionData;
		initialName?: string;
		initialDescription?: string;
		initialItems?: unknown;
	};

	let {
		mode,
		form = null,
		initialName = '',
		initialDescription = '',
		initialItems = []
	}: Props = $props();
	let itemSequence = 0;

	const emptyItem = (expanded = true): DraftItem => ({
		key: `item-${itemSequence++}`,
		title: '',
		type: '',
		genres: '',
		img: '',
		year: undefined,
		imdbRating: undefined,
		expanded,
		showErrors: false
	});

	const toDraftItem = (value: unknown): DraftItem => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return emptyItem(mode === 'create');
		}
		const item = value as Record<string, unknown>;
		return {
			key: `item-${itemSequence++}`,
			title: typeof item.title === 'string' ? item.title : '',
			type: item.type === 'movie' || item.type === 'series' ? item.type : '',
			genres: Array.isArray(item.genres)
				? item.genres.filter((genre): genre is string => typeof genre === 'string').join(', ')
				: '',
			img: typeof item.img === 'string' ? item.img : '',
			year: typeof item.year === 'number' ? item.year : undefined,
			imdbRating:
				typeof item.imdbRating === 'number' && item.imdbRating > 0 ? item.imdbRating : undefined,
			expanded: mode === 'create',
			showErrors: false
		};
	};

	const restoreItems = () => {
		let saved: unknown = initialItems;
		if (form?.values?.itemsJson) {
			try {
				saved = JSON.parse(form.values.itemsJson);
			} catch {
				saved = [];
			}
		}
		return Array.isArray(saved) && saved.length > 0 ? saved.map(toDraftItem) : [emptyItem()];
	};
	const restoreName = () => form?.values?.name ?? initialName;
	const restoreDescription = () => form?.values?.description ?? initialDescription;

	let listName = $state(restoreName());
	let description = $state(restoreDescription());
	let items = $state<DraftItem[]>(restoreItems());
	let showListErrors = $state(false);

	const hasGenres = (item: DraftItem) =>
		item.genres
			.split(',')
			.map((genre) => genre.trim())
			.some(Boolean);
	const hasValidYear = (item: DraftItem) =>
		Number.isInteger(item.year) && Number(item.year) >= 1888 && Number(item.year) <= 2100;
	const hasValidRating = (item: DraftItem) =>
		item.imdbRating === undefined ||
		(Number.isFinite(item.imdbRating) && item.imdbRating >= 0 && item.imdbRating <= 10);
	const hasValidPoster = (item: DraftItem) => {
		if (!item.img.trim()) return true;
		try {
			const url = new URL(item.img);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	};
	const isComplete = (item: DraftItem) =>
		Boolean(
			item.title.trim() &&
			item.type &&
			hasGenres(item) &&
			hasValidYear(item) &&
			hasValidPoster(item) &&
			hasValidRating(item)
		);
	const hasValidListName = () => Boolean(listName.trim() && listName.length <= 80);
	const hasValidDescription = () => description.length <= 500;
	const hasValidListDetails = () => hasValidListName() && hasValidDescription();
	const hasValidationErrors = $derived(
		!hasValidListDetails() || items.length === 0 || items.some((item) => !isComplete(item))
	);
	const hasVisibleValidationErrors = $derived(
		(showListErrors && !hasValidListDetails()) ||
			items.some((item) => item.showErrors && !isComplete(item))
	);
	const payload = $derived(
		JSON.stringify(
			items.map((item) => ({
				title: item.title.trim(),
				type: item.type,
				genres: item.genres
					.split(',')
					.map((genre) => genre.trim())
					.filter(Boolean),
				img: item.img.trim(),
				year: item.year,
				imdbRating: item.imdbRating ?? 0
			}))
		)
	);

	const removeItem = (key: string) => {
		if (items.length > 1) items = items.filter((item) => item.key !== key);
	};

	const handleSubmit = (event: SubmitEvent) => {
		showListErrors = !hasValidListDetails();
		for (const item of items) {
			if (!isComplete(item)) {
				item.showErrors = true;
				item.expanded = true;
			}
		}
		if (!hasValidationErrors) return;

		event.preventDefault();
		void tick().then(() => {
			document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		});
	};
</script>

<svelte:head>
	<title>{mode === 'create' ? 'New watch list' : 'Edit watch list'} — Reelmate</title>
	<meta
		name="description"
		content={mode === 'create'
			? 'Create a movie and series list for your next Reelmate party.'
			: 'Edit a saved Reelmate movie and series list.'}
	/>
</svelte:head>

<div class="relative isolate min-h-dvh overflow-hidden bg-[#0b0910] text-(--ink)">
	<div
		class="pointer-events-none fixed -top-60 -left-44 -z-1 size-160 rounded-full bg-[#7c5cff]/18 blur-[120px]"
	></div>
	<header class="border-b border-white/7 px-5 py-5">
		<div class="mx-auto flex w-[min(100%,1000px)] items-center justify-between">
			<ReelmateLogo /><a
				href={resolve('/profile')}
				class="text-xs font-bold text-(--muted) no-underline hover:text-white">← Back to lists</a
			>
		</div>
	</header>

	<main class="mx-auto w-[min(100%,1000px)] px-5 py-10 min-[760px]:py-14">
		<p class="mb-3 text-[10px] font-extrabold tracking-[0.2em] text-(--rose) uppercase">
			{mode === 'create' ? 'Build your deck' : 'Update your deck'}
		</p>
		<h1 class="m-0 text-[clamp(40px,7vw,62px)] leading-none font-[850] tracking-[-0.06em]">
			{mode === 'create' ? 'Create a list' : 'Edit list'}
		</h1>
		<p class="mt-4 max-w-150 text-sm leading-relaxed text-(--muted)">
			{mode === 'create'
				? 'Give the list a name, then add every movie or series you want available for matching.'
				: 'Change the list details or any title, then save your updates.'}
		</p>

		<form method="POST" class="mt-9 space-y-6" novalidate onsubmit={handleSubmit}>
			<input type="hidden" name="items" value={payload} />
			<section
				class="grid gap-5 rounded-[26px] border border-white/9 bg-white/3 p-5 min-[700px]:grid-cols-2 min-[700px]:p-7"
			>
				<div>
					<label for="name" class="mb-2 block text-xs font-bold text-[#d8d2e2]"
						>List name <span class="text-(--rose)">*</span></label
					><input
						id="name"
						name="name"
						bind:value={listName}
						required
						maxlength="80"
						placeholder="Friday night favourites"
						aria-invalid={showListErrors && !hasValidListName()}
						aria-describedby={showListErrors && !hasValidListName() ? 'name-error' : undefined}
						class="box-border w-full rounded-2xl border bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {showListErrors &&
						!hasValidListName()
							? 'border-[#ff5c74]/60'
							: 'border-white/12'}"
					/>
					{#if showListErrors && !hasValidListName()}<small
							id="name-error"
							class="mt-1.5 block text-[10px] text-[#ff8ca0]"
							>{listName.trim()
								? 'List name cannot exceed 80 characters.'
								: 'List name is required.'}</small
						>{/if}
				</div>
				<div>
					<label for="description" class="mb-2 block text-xs font-bold text-[#d8d2e2]"
						>Description <span class="font-normal text-(--muted)">(optional)</span></label
					><input
						id="description"
						name="description"
						bind:value={description}
						maxlength="500"
						placeholder="Comedies everyone will enjoy"
						aria-invalid={showListErrors && !hasValidDescription()}
						aria-describedby={showListErrors && !hasValidDescription()
							? 'description-error'
							: undefined}
						class="box-border w-full rounded-2xl border bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {showListErrors &&
						!hasValidDescription()
							? 'border-[#ff5c74]/60'
							: 'border-white/12'}"
					/>
					{#if showListErrors && !hasValidDescription()}<small
							id="description-error"
							class="mt-1.5 block text-[10px] text-[#ff8ca0]"
							>Description cannot exceed 500 characters.</small
						>{/if}
				</div>
			</section>

			<div class="space-y-5">
				{#each items as item, index (item.key)}
					<details
						bind:open={item.expanded}
						class="group overflow-hidden rounded-[26px] border border-white/9 bg-[linear-gradient(145deg,rgba(29,25,39,.92),rgba(15,13,20,.97))] shadow-[0_18px_55px_rgba(0,0,0,.22)]"
					>
						<summary
							class="flex cursor-pointer list-none items-center justify-between gap-4 p-5 select-none marker:hidden min-[700px]:px-7 min-[700px]:py-6 [&::-webkit-details-marker]:hidden"
						>
							<div class="min-w-0">
								<span class="text-[10px] font-extrabold tracking-[0.16em] text-(--rose) uppercase"
									>Title {index + 1}</span
								>
								<h2 class="mt-1 truncate text-lg font-extrabold tracking-[-0.03em]">
									{item.title || 'Untitled'}
								</h2>
							</div>
							<div class="flex flex-none items-center gap-2.5">
								{#if item.showErrors && !isComplete(item)}<span
										class="hidden rounded-full border border-[#ff5c74]/30 bg-[#ff5c74]/10 px-2.5 py-1 text-[9px] font-extrabold tracking-[0.08em] text-[#ff8ca0] uppercase min-[520px]:inline-flex"
										>Needs attention</span
									>{:else if item.type}<span
										class="hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-extrabold tracking-[0.08em] text-(--muted) uppercase min-[520px]:inline-flex"
										>{item.type}{item.year ? ` · ${item.year}` : ''}</span
									>{/if}
								<svg
									viewBox="0 0 24 24"
									class="size-5 text-(--muted) transition-transform duration-200 group-open:rotate-180"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="m6 9 6 6 6-6" />
								</svg>
							</div>
						</summary>
						<div class="border-t border-white/7 p-5 min-[700px]:p-7">
							{#if items.length > 1}<div class="mb-5 flex justify-end">
									<button
										type="button"
										onclick={() => removeItem(item.key)}
										class="cursor-pointer rounded-xl border border-white/9 bg-white/4 px-3 py-2 text-xs font-bold text-(--muted) hover:text-white"
										>Remove title</button
									>
								</div>{/if}
							<div class="grid gap-5 min-[700px]:grid-cols-2">
								<div>
									<label for={`title-${item.key}`} class="mb-2 block text-xs font-bold"
										>Title <span class="text-(--rose)">*</span></label
									><input
										id={`title-${item.key}`}
										bind:value={item.title}
										required
										maxlength="160"
										placeholder="Dune: Part Two"
										aria-invalid={item.showErrors && !item.title.trim()}
										aria-describedby={item.showErrors && !item.title.trim()
											? `title-error-${item.key}`
											: undefined}
										class="box-border w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {item.showErrors &&
										!item.title.trim()
											? 'border-[#ff5c74]/60'
											: 'border-white/12'}"
									/>
									{#if item.showErrors && !item.title.trim()}<small
											id={`title-error-${item.key}`}
											class="mt-1.5 block text-[10px] text-[#ff8ca0]">Title is required.</small
										>{/if}
								</div>
								<div>
									<label for={`type-${item.key}`} class="mb-2 block text-xs font-bold"
										>Type <span class="text-(--rose)">*</span></label
									><select
										id={`type-${item.key}`}
										bind:value={item.type}
										required
										aria-invalid={item.showErrors && !item.type}
										aria-describedby={item.showErrors && !item.type
											? `type-error-${item.key}`
											: undefined}
										class="box-border w-full rounded-xl border bg-[#15121c] px-4 py-3 text-sm text-white outline-none focus:border-(--purple) {item.showErrors &&
										!item.type
											? 'border-[#ff5c74]/60'
											: 'border-white/12'}"
										><option value="" disabled>Select type</option><option value="movie"
											>Movie</option
										><option value="series">Series</option></select
									>
									{#if item.showErrors && !item.type}<small
											id={`type-error-${item.key}`}
											class="mt-1.5 block text-[10px] text-[#ff8ca0]">Type is required.</small
										>{/if}
								</div>
								<div>
									<label for={`genres-${item.key}`} class="mb-2 block text-xs font-bold"
										>Genres <span class="text-(--rose)">*</span></label
									><input
										id={`genres-${item.key}`}
										bind:value={item.genres}
										required
										placeholder="Drama, Sci-Fi"
										aria-invalid={item.showErrors && !hasGenres(item)}
										aria-describedby={`genres-help-${item.key}${item.showErrors && !hasGenres(item) ? ` genres-error-${item.key}` : ''}`}
										class="box-border w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {hasGenres(
											item
										) || !item.showErrors
											? 'border-white/12'
											: 'border-[#ff5c74]/60'}"
									/><small
										id={`genres-help-${item.key}`}
										class="mt-1.5 block text-[10px] text-(--muted)"
										>Separate genres with commas.</small
									>
									{#if item.showErrors && !hasGenres(item)}<small
											id={`genres-error-${item.key}`}
											class="mt-1 block text-[10px] text-[#ff8ca0]"
											>At least one genre is required.</small
										>{/if}
								</div>
								<div>
									<label for={`year-${item.key}`} class="mb-2 block text-xs font-bold"
										>Year <span class="text-(--rose)">*</span></label
									><input
										id={`year-${item.key}`}
										type="number"
										bind:value={item.year}
										required
										min="1888"
										max="2100"
										step="1"
										placeholder="2024"
										aria-invalid={item.showErrors && !hasValidYear(item)}
										aria-describedby={item.showErrors && !hasValidYear(item)
											? `year-error-${item.key}`
											: undefined}
										class="box-border w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {hasValidYear(
											item
										) || !item.showErrors
											? 'border-white/12'
											: 'border-[#ff5c74]/60'}"
									/>
									{#if item.showErrors && !hasValidYear(item)}<small
											id={`year-error-${item.key}`}
											class="mt-1.5 block text-[10px] text-[#ff8ca0]"
											>{item.year === undefined
												? 'Year is required.'
												: 'Enter a whole year from 1888 to 2100.'}</small
										>{/if}
								</div>
								<div>
									<label for={`img-${item.key}`} class="mb-2 block text-xs font-bold"
										>Poster URL <span class="font-normal text-(--muted)">(optional)</span></label
									><input
										id={`img-${item.key}`}
										type="url"
										bind:value={item.img}
										placeholder="https://…/poster.jpg"
										aria-invalid={item.showErrors && !hasValidPoster(item)}
										aria-describedby={item.showErrors && !hasValidPoster(item)
											? `img-error-${item.key}`
											: undefined}
										class="box-border w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {item.showErrors &&
										!hasValidPoster(item)
											? 'border-[#ff5c74]/60'
											: 'border-white/12'}"
									/>
									{#if item.showErrors && !hasValidPoster(item)}<small
											id={`img-error-${item.key}`}
											class="mt-1.5 block text-[10px] text-[#ff8ca0]"
											>Enter a valid HTTP or HTTPS poster URL.</small
										>{/if}
								</div>
								<div>
									<label for={`rating-${item.key}`} class="mb-2 block text-xs font-bold"
										>IMDb rating <span class="font-normal text-(--muted)">(optional)</span></label
									><input
										id={`rating-${item.key}`}
										type="number"
										bind:value={item.imdbRating}
										min="0"
										max="10"
										step="0.1"
										placeholder="Unknown"
										aria-invalid={item.showErrors && !hasValidRating(item)}
										aria-describedby={item.showErrors && !hasValidRating(item)
											? `rating-error-${item.key}`
											: undefined}
										class="box-border w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {hasValidRating(
											item
										) || !item.showErrors
											? 'border-white/12'
											: 'border-[#ff5c74]/60'}"
									/>
									{#if item.showErrors && !hasValidRating(item)}<small
											id={`rating-error-${item.key}`}
											class="mt-1.5 block text-[10px] text-[#ff8ca0]"
											>IMDb rating must be between 0 and 10.</small
										>{/if}
								</div>
							</div>
						</div>
					</details>
				{/each}
			</div>

			<button
				type="button"
				onclick={() => (items = [...items, emptyItem()])}
				class="w-full cursor-pointer rounded-2xl border border-dashed border-white/16 bg-white/3 px-5 py-4 text-sm font-extrabold text-white transition hover:border-(--purple) hover:bg-(--purple)/7"
				>+ Add another movie or series</button
			>
			{#if hasVisibleValidationErrors}<p
					class="rounded-2xl border border-[#ff5c74]/25 bg-[#ff5c74]/8 px-4 py-3 text-sm text-[#ff9aac]"
					role="alert"
				>
					Complete the highlighted fields before saving the list.
				</p>{/if}
			{#if form?.message}<p
					class="rounded-2xl border border-(--gold)/25 bg-(--gold)/8 px-4 py-3 text-sm text-(--gold)"
					role="alert"
				>
					{form.message}
				</p>{/if}
			<div class="flex flex-col-reverse gap-3 min-[600px]:flex-row min-[600px]:justify-end">
				<a
					href={resolve('/profile')}
					class="rounded-2xl border border-white/10 px-5 py-3.5 text-center text-sm font-bold text-white no-underline"
					>Cancel</a
				><button
					type="submit"
					class="cursor-pointer rounded-2xl border-0 bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-6 py-3.5 text-sm font-extrabold text-[#160b10] shadow-[0_12px_30px_rgba(255,63,102,.22)] transition hover:-translate-y-0.5"
					>{mode === 'create' ? 'Create list' : 'Save changes'} →</button
				>
			</div>
		</form>
	</main>
</div>
