<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import type { MediaItem } from '#lib/types.js';

	type Result = Omit<MediaItem, 'id' | 'year'> & { year: number | null };
	let { onadd, onmanual }: { onadd: (item: Result) => void; onmanual: (title: string) => void } =
		$props();
	let query = $state('');
	let results = $state.raw<Result[]>([]);
	let message = $state('');
	let busy = $state(false);
	let version = 0;
	let activeRequest: AbortController | undefined;

	onDestroy(cancelSearch);

	function cancelSearch() {
		version++;
		activeRequest?.abort();
		activeRequest = undefined;
	}

	function reset() {
		cancelSearch();
		results = [];
		message = '';
		busy = false;
	}

	async function search() {
		if (busy || !query.trim()) return;
		reset();
		const request = version;
		const controller = new AbortController();
		activeRequest = controller;
		busy = true;
		// Allow the server's 15-second TMDB timeout to finish before cancelling locally.
		const timeout = setTimeout(() => controller.abort(), 20_000);
		try {
			const response = await fetch(
				resolve('/api/titles/search') + '?' + new URLSearchParams({ q: query.trim() }),
				{ signal: controller.signal }
			);
			if (request !== version) return;
			if (!response.ok) {
				message =
					response.status === 429
						? 'Search is busy. Try again later or add this title manually.'
						: 'Search is unavailable. Try again or add this title manually.';
				return;
			}
			const matches: Result[] = await response.json();
			if (request !== version) return;
			results = matches;
			message = matches.length
				? 'Choose a title to add.'
				: 'No titles found. Try another name or add this title manually.';
		} catch {
			if (request === version)
				message = 'Search is unavailable. Try again or add this title manually.';
		} finally {
			clearTimeout(timeout);
			if (request === version) {
				busy = false;
				activeRequest = undefined;
			}
		}
	}

	function added(title: string) {
		reset();
		query = '';
		message = title + ' added.';
	}
</script>

<section class="space-y-3 rounded-3xl border border-white/10 p-5">
	<label for="title-search" class="block font-bold">Search movies and series</label>
	<div class="flex gap-2">
		<input
			id="title-search"
			type="search"
			maxlength="200"
			bind:value={query}
			oninput={reset}
			onkeydown={(event) => {
				if (event.key === 'Enter' && !event.isComposing) {
					event.preventDefault();
					void search();
				}
			}}
			class="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2.5"
			placeholder="Movie or series title"
		/>
		<button
			type="button"
			disabled={busy || !query.trim()}
			onclick={search}
			class="rounded-xl bg-(--rose) px-4 font-bold text-black disabled:opacity-50">Search</button
		>
	</div>
	<p role="status" class="text-sm text-(--muted) empty:hidden">{busy ? 'Searching…' : message}</p>
	{#if results.length}
		<ul class="max-h-80 divide-y divide-white/10 overflow-y-auto">
			{#each results as item (item)}
				<li>
					<button
						type="button"
						class="flex w-full items-center justify-between gap-4 px-2 py-3 text-left hover:bg-white/5"
						onclick={() => {
							onadd(item);
							added(item.title);
						}}
					>
						<span
							><strong>{item.title}</strong><small class="block text-(--muted)"
								>{item.type === 'movie' ? 'Movie' : 'Series'} · {item.year ?? 'Year unknown'}</small
							></span
						>
						<span class="text-sm text-(--rose)">Add</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<button
		type="button"
		class="py-2 text-sm text-(--muted) underline underline-offset-4"
		onclick={() => {
			onmanual(query.trim());
			query = '';
			reset();
		}}>Add a title manually</button
	>
</section>
