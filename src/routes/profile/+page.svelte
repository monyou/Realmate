<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import RealmateLogo from '$lib/components/RealmateLogo.svelte';
	import ShareListDialog from '$lib/components/ShareListDialog.svelte';
	import { selectionAfterDelete } from '$lib/list-selection';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let selected = $state<string[]>([]);
	let shareList = $state<{ id: string; name: string } | null>(null);
	let deleteTarget = $state<{ id: string; name: string } | null>(null);
	let openListDetails = $state<string | null>(null);
	let deleteDialog: HTMLDialogElement;
	let submitting = $state(false);
	let loadingLabel = $state('Working on it…');

	const handleSubmit: SubmitFunction = ({ formElement, formData }) => {
		loadingLabel = formElement.dataset.loadingLabel ?? 'Working on it…';
		const closeDialogOnSuccess = formElement.dataset.closeDialogOnSuccess === 'true';
		const removeSelectionOnSuccess = formElement.dataset.removeSelectionOnSuccess === 'true';
		const submittedListId = removeSelectionOnSuccess ? String(formData.get('listId') ?? '') : '';
		submitting = true;
		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					selected = selectionAfterDelete(selected, submittedListId, removeSelectionOnSuccess);
					if (closeDialogOnSuccess) cancelDelete();
				}
				await update();
			} finally {
				submitting = false;
			}
		};
	};

	const confirmDelete = (list: { id: string; name: string }) => {
		deleteTarget = list;
		deleteDialog.showModal();
	};
	const cancelDelete = () => {
		deleteDialog.close();
		deleteTarget = null;
	};
	const toggleListDetails = (event: MouseEvent, listId: string) => {
		event.stopPropagation();
		openListDetails = openListDetails === listId ? null : listId;
	};

	const formatDate = (value: string) =>
		new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
			new Date(value)
		);
</script>

<svelte:head>
	<title>Your lists — Realmate</title>
	<meta name="description" content="Manage your Realmate movie and series lists." />
</svelte:head>

<svelte:window
	onclick={() => (openListDetails = null)}
	onkeydown={(event) => {
		if (event.key === 'Escape') openListDetails = null;
	}}
/>

<div class="relative isolate min-h-dvh overflow-hidden bg-[#0b0910] text-(--ink)">
	<div
		class="pointer-events-none fixed -top-60 -left-44 -z-1 size-160 rounded-full bg-[#7c5cff]/18 blur-[120px]"
	></div>
	<div
		class="pointer-events-none fixed -right-44 -bottom-64 -z-1 size-150 rounded-full bg-[#ff3f66]/14 blur-[120px]"
	></div>

	<header class="border-b border-white/7 px-5 py-5 backdrop-blur-xl">
		<div class="mx-auto flex w-[min(100%,1120px)] items-center justify-between gap-4">
			<RealmateLogo />
			<div class="flex items-center gap-3">
				<span class="hidden max-w-56 truncate text-xs text-(--muted) min-[600px]:block"
					>{data.user.email}</span
				>
				<form
					method="POST"
					action="?/logout"
					data-loading-label="Logging out…"
					use:enhance={handleSubmit}
				>
					<button
						class="cursor-pointer rounded-full border border-white/10 bg-white/4 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/9"
						>Log out</button
					>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto w-[min(100%,1120px)] px-5 py-10 min-[760px]:py-15">
		<div class="flex flex-col justify-between gap-6 min-[700px]:flex-row min-[700px]:items-end">
			<div>
				<p class="mb-3 text-[10px] font-extrabold tracking-[0.2em] text-(--rose) uppercase">
					Your profile
				</p>
				<h1 class="m-0 text-[clamp(40px,7vw,64px)] leading-none font-[850] tracking-[-0.06em]">
					Watch lists
				</h1>
				<p class="mt-4 max-w-150 text-sm leading-relaxed text-(--muted)">
					Build collections for different moods, then select one or several to create a shared
					matching room.
				</p>
			</div>
			<div class="flex flex-col gap-3 min-[430px]:flex-row">
				<a
					href={resolve('/profile/lists/generate')}
					class="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--purple)/35 bg-(--purple)/10 px-5 py-3.5 text-sm font-extrabold text-[#c8beff] no-underline shadow-[0_12px_28px_rgba(124,92,255,.1)] transition hover:-translate-y-0.5 hover:border-(--purple)/60 hover:bg-(--purple)/16"
					><span class="text-base" aria-hidden="true">✦</span> Generate list</a
				>
				<a
					href={resolve('/profile/lists/new')}
					class="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-3.5 text-sm font-extrabold text-[#160b10] no-underline shadow-[0_12px_28px_rgba(255,63,102,.2)] transition hover:-translate-y-0.5"
					><span class="text-lg">+</span> New list</a
				>
			</div>
		</div>

		{#if data.loadError}<p
				class="mt-7 rounded-2xl border border-(--gold)/25 bg-(--gold)/8 px-4 py-3 text-sm text-(--gold)"
				role="alert"
			>
				{data.loadError}
			</p>{/if}

		{#if data.lists.length === 0}
			<section
				class="mt-10 grid min-h-75 place-items-center rounded-[30px] border border-dashed border-white/13 bg-white/3 p-8 text-center"
			>
				<div>
					<div
						class="mx-auto grid size-16 place-items-center rounded-2xl border border-white/9 bg-white/4 text-2xl text-(--rose)"
					>
						☆
					</div>
					<h2 class="mt-5 text-xl font-extrabold tracking-[-0.03em]">Your shelf is empty</h2>
					<p class="mx-auto mt-2 max-w-100 text-sm leading-relaxed text-(--muted)">
						Create a list and add the movies or series you want your group to swipe through.
					</p>
					<a
						href={resolve('/profile/lists/new')}
						class="mt-6 inline-block rounded-xl border border-white/12 bg-white/7 px-4 py-3 text-sm font-bold text-white no-underline"
						>Create your first list</a
					>
				</div>
			</section>
		{:else}
			<form
				method="POST"
				action="?/startParty"
				class="mt-10"
				data-loading-label="Starting your party…"
				use:enhance={handleSubmit}
			>
				{#if selected.length > 0}
					<div
						class="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/12 bg-[#18141f]/95 p-3 pl-5 shadow-[0_16px_50px_rgba(0,0,0,.3)] backdrop-blur-xl"
					>
						<span class="text-xs font-bold text-(--muted)"
							>{selected.length} {selected.length === 1 ? 'list' : 'lists'} selected</span
						>
						<button
							type="submit"
							class="cursor-pointer rounded-xl border-0 bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-3 text-sm font-extrabold text-[#160b10]"
							>Start matching →</button
						>
					</div>
				{/if}
				{#if form?.message}<p class="mb-4 text-sm text-(--gold)" role="alert">
						{form.message}
					</p>{/if}
				<div
					class="overflow-visible rounded-[26px] border border-white/9 bg-[linear-gradient(145deg,rgba(28,24,38,.9),rgba(15,13,20,.96))] shadow-[0_22px_70px_rgba(0,0,0,.25)] min-[720px]:overflow-hidden"
				>
					<div
						class="hidden grid-cols-[32px_28px_minmax(0,1fr)_90px_120px_120px] gap-4 border-b border-white/7 px-5 py-3 text-[10px] font-extrabold tracking-[0.14em] text-(--muted) uppercase min-[720px]:grid"
					>
						<span></span><span></span><span>List</span><span>Titles</span><span>Last updated</span
						><span></span>
					</div>
					{#each data.lists as list (list.id)}
						<div
							class="grid grid-cols-[34px_26px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-white/6 px-4 py-5 transition last:border-0 hover:bg-white/3 min-[720px]:grid-cols-[32px_28px_minmax(0,1fr)_90px_120px_120px] min-[720px]:gap-4 min-[720px]:px-5"
						>
							<input
								type="checkbox"
								name="listId"
								value={list.id}
								bind:group={selected}
								aria-label={`Select ${list.name}`}
								class="size-4.5 cursor-pointer accent-[#ff5c74]"
							/>
							<span class="grid size-7 place-items-center text-(--purple)">
								{#if list.isShared}
									<svg
										viewBox="0 0 24 24"
										class="size-4"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-label={`${list.name} is shared`}
										role="img"
									>
										<circle cx="18" cy="5" r="3" />
										<circle cx="6" cy="12" r="3" />
										<circle cx="18" cy="19" r="3" />
										<path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
									</svg>
								{/if}
							</span>
							<div class="relative min-w-0 min-[720px]:hidden">
								<button
									type="button"
									onclick={(event) => toggleListDetails(event, list.id)}
									aria-label={`Show full name and description for ${list.name}`}
									aria-expanded={openListDetails === list.id}
									aria-describedby={openListDetails === list.id
										? `list-details-${list.id}`
										: undefined}
									class="block w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left"
								>
									<strong class="block truncate text-sm text-white">{list.name}</strong>
									{#if list.description}<small
											class="mt-1 block truncate text-[11px] text-(--muted)"
											>{list.description}</small
										>{/if}
								</button>
								{#if openListDetails === list.id}
									<div
										id={`list-details-${list.id}`}
										role="tooltip"
										class="absolute top-[calc(100%+10px)] left-0 z-50 w-[min(72vw,320px)] rounded-2xl border border-white/14 bg-[#18141f] p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,.55)]"
									>
										<strong class="block text-sm leading-snug wrap-break-word text-white"
											>{list.name}</strong
										>
										<p class="mt-2 text-xs leading-relaxed wrap-break-word text-(--muted)">
											{list.description || 'No description'}
										</p>
									</div>
								{/if}
							</div>
							<span
								class="hidden min-w-0 min-[720px]:block"
								title={list.description ? `${list.name} — ${list.description}` : list.name}
								><strong class="block truncate text-sm text-white">{list.name}</strong
								>{#if list.description}<small class="mt-1 block truncate text-[11px] text-(--muted)"
										>{list.description}</small
									>{/if}</span
							>
							<span class="text-xs font-bold text-[#d7d0e2]"
								>{list.itemCount}<span class="ml-1 min-[720px]:hidden">titles</span></span
							>
							<span class="hidden text-xs text-(--muted) min-[720px]:block"
								>{formatDate(list.updatedAt)}</span
							>
							<div class="flex justify-end gap-1">
								<a
									href={resolve('/profile/lists/[id]/edit', { id: list.id })}
									aria-label={`Edit ${list.name}`}
									title={`Edit ${list.name}`}
									class="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/4 text-(--muted) no-underline transition hover:border-(--purple)/50 hover:bg-(--purple)/10 hover:text-white"
								>
									<svg
										viewBox="0 0 24 24"
										class="size-4"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="M12 20h9" />
										<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
									</svg>
								</a>
								{#if list.isOwner}
									<button
										type="button"
										onclick={() => (shareList = { id: list.id, name: list.name })}
										aria-label={`Share ${list.name}`}
										title={`Share ${list.name}`}
										class="grid size-9 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/4 text-(--muted) transition hover:border-(--purple)/50 hover:bg-(--purple)/10 hover:text-white"
									>
										<svg
											viewBox="0 0 24 24"
											class="size-4"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
										>
											<circle cx="18" cy="5" r="3" />
											<circle cx="6" cy="12" r="3" />
											<circle cx="18" cy="19" r="3" />
											<path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
										</svg>
									</button>
									<button
										type="button"
										onclick={() => confirmDelete({ id: list.id, name: list.name })}
										aria-label={`Delete ${list.name}`}
										title={`Delete ${list.name}`}
										class="grid size-9 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/4 text-(--muted) transition hover:border-[#ff5c74]/50 hover:bg-[#ff5c74]/10 hover:text-[#ff8ca0]"
									>
										<svg
											viewBox="0 0 24 24"
											class="size-4"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
										>
											<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
										</svg>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</form>
		{/if}
	</main>

	<ShareListDialog list={shareList} onClose={() => (shareList = null)} />

	<dialog
		bind:this={deleteDialog}
		oncancel={(event) => {
			event.preventDefault();
			cancelDelete();
		}}
		onclick={(event) => {
			if (event.target === deleteDialog) cancelDelete();
		}}
		class="m-auto box-border w-[min(92vw,460px)] rounded-[26px] border border-white/12 bg-[#14111a] p-0 text-(--ink) shadow-[0_30px_100px_rgba(0,0,0,.65)] backdrop:bg-black/75"
	>
		<div class="p-6">
			<p class="text-[10px] font-extrabold tracking-[0.16em] text-[#ff8ca0] uppercase">
				Delete list
			</p>
			<h2 class="mt-2 text-2xl font-extrabold tracking-[-0.04em]">Delete {deleteTarget?.name}?</h2>
			<p class="mt-3 text-sm leading-relaxed text-(--muted)">
				This permanently removes the list for you and everyone it is shared with. This cannot be
				undone.
			</p>
			<form
				method="POST"
				action="?/deleteList"
				class="mt-6 flex justify-end gap-3"
				data-loading-label="Deleting your list…"
				data-close-dialog-on-success="true"
				data-remove-selection-on-success="true"
				use:enhance={handleSubmit}
			>
				<input type="hidden" name="listId" value={deleteTarget?.id ?? ''} />
				<button
					type="button"
					onclick={cancelDelete}
					class="cursor-pointer rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm font-bold text-white"
					>Cancel</button
				>
				<button
					type="submit"
					class="cursor-pointer rounded-xl border border-[#ff5c74]/35 bg-[#ff5c74]/12 px-4 py-3 text-sm font-extrabold text-[#ff9aac]"
					>Delete list</button
				>
			</form>
		</div>
	</dialog>
</div>

<LoadingOverlay visible={submitting} label={loadingLabel} />
