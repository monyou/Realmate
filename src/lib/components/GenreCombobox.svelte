<script lang="ts">
	import {
		applyGenreSuggestion,
		genreSuggestions,
		type MediaGenre,
		validateGenreInput
	} from '$lib/media-genres';

	type Props = {
		id: string;
		value?: string;
		invalid?: boolean;
		describedBy?: string;
	};

	let { id, value = $bindable(''), invalid = false, describedBy = undefined }: Props = $props();
	let input: HTMLInputElement;
	let open = $state(false);
	let activeIndex = $state(0);
	const suggestions = $derived(genreSuggestions(value));
	const hasThreeGenres = $derived(
		validateGenreInput(value).valid && validateGenreInput(value).genres.length === 3
	);
	const popupVisible = $derived(open && !hasThreeGenres);
	const listboxId = $derived(`${id}-suggestions`);

	const showSuggestions = () => {
		activeIndex = 0;
		open = true;
	};

	const choose = (genre: MediaGenre) => {
		value = applyGenreSuggestion(value, genre);
		activeIndex = 0;
		open = false;
		input.focus();
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			open = false;
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (!open) {
				open = true;
				activeIndex = 0;
			} else if (suggestions.length > 0) {
				activeIndex = (activeIndex + 1) % suggestions.length;
			}
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (!open) {
				open = true;
				activeIndex = Math.max(0, suggestions.length - 1);
			} else if (suggestions.length > 0) {
				activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
			}
			return;
		}
		if (event.key === 'Enter' && open && suggestions[activeIndex]) {
			event.preventDefault();
			choose(suggestions[activeIndex]);
		}
	};
</script>

<div class="relative">
	<input
		bind:this={input}
		{id}
		bind:value
		type="text"
		role="combobox"
		required
		autocomplete="off"
		placeholder="Drama, Sci-Fi"
		aria-autocomplete="list"
		aria-expanded={popupVisible}
		aria-controls={listboxId}
		aria-activedescendant={open && suggestions[activeIndex]
			? `${listboxId}-${activeIndex}`
			: undefined}
		aria-invalid={invalid}
		aria-describedby={describedBy}
		onfocus={showSuggestions}
		oninput={showSuggestions}
		onkeydown={handleKeydown}
		onblur={() => setTimeout(() => (open = false), 120)}
		class="box-border w-full rounded-xl border bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {invalid
			? 'border-[#ff5c74]/60'
			: 'border-white/12'}"
	/>
	<button
		type="button"
		tabindex="-1"
		aria-label={popupVisible ? 'Close genre suggestions' : 'Show genre suggestions'}
		onmousedown={(event) => event.preventDefault()}
		onclick={() => {
			open = !open;
			activeIndex = 0;
			input.focus();
		}}
		class="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-(--muted) hover:bg-white/6 hover:text-white"
	>
		<svg
			viewBox="0 0 24 24"
			class="size-4 transition-transform {popupVisible ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if popupVisible}
		<div
			id={listboxId}
			role="listbox"
			aria-label="Genre suggestions"
			class="absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-white/12 bg-[#18141f] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]"
		>
			{#if suggestions.length > 0}
				{#each suggestions as genre, index (genre)}
					<button
						id={`${listboxId}-${index}`}
						type="button"
						role="option"
						tabindex="-1"
						aria-selected={index === activeIndex}
						onmouseenter={() => (activeIndex = index)}
						onmousedown={(event) => event.preventDefault()}
						onclick={() => choose(genre)}
						class="block w-full cursor-pointer rounded-lg border-0 px-3 py-2.5 text-left text-xs font-bold {index ===
						activeIndex
							? 'bg-(--purple)/18 text-white'
							: 'bg-transparent text-[#d7d0e2] hover:bg-white/6'}"
					>
						{genre}
					</button>
				{/each}
			{:else}
				<p class="m-0 px-3 py-3 text-xs text-(--muted)">No matching genres.</p>
			{/if}
		</div>
	{/if}
</div>
