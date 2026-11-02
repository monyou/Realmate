<script lang="ts">
	import { untrack } from 'svelte';
	import { refreshAll } from '$app/navigation';
	import { ListSharingEditor } from '#lib/list-sharing.svelte.js';

	type SharedList = { id: string; name: string };
	let { list, onClose }: { list: SharedList | null; onClose: () => void } = $props();
	let dialog = $state<HTMLDialogElement>();
	const selectedId = $derived(list?.id);
	const editor = new ListSharingEditor();

	$effect(() => {
		const id = selectedId;
		const element = dialog;
		if (!element) return;
		return untrack(() => {
			if (!id) {
				element.close();
				editor.close();
				return;
			}
			if (!element.open) element.showModal();
			void editor.open(id);
			return () => editor.close();
		});
	});

	async function save() {
		const id = list?.id;
		if (!id) return;
		await editor.save(id, async () => {
			await refreshAll();
			if (list?.id === id) onClose();
		});
	}
</script>

<dialog
	bind:this={dialog}
	oncancel={(event) => {
		event.preventDefault();
		if (!editor.saving) onClose();
	}}
	onclick={(event) => {
		if (event.target === dialog && !editor.saving) onClose();
	}}
	class="m-auto box-border w-[min(92vw,620px)] rounded-[28px] border border-white/12 bg-[#14111a] p-0 text-(--ink) shadow-[0_30px_100px_rgba(0,0,0,.65)] backdrop:bg-black/75"
>
	<div class="p-5 min-[600px]:p-7">
		<div class="flex items-start justify-between gap-5">
			<div class="min-w-0">
				<p class="text-[10px] font-extrabold tracking-[0.16em] text-(--rose) uppercase">
					Share list
				</p>
				<h2 class="mt-1 truncate text-2xl font-extrabold tracking-[-0.04em]">{list?.name ?? ''}</h2>
				<p class="mt-2 text-xs leading-relaxed text-(--muted)">
					Friends with an existing Realmate account can edit this list with you.
				</p>
			</div>
			<button
				type="button"
				disabled={editor.saving}
				onclick={onClose}
				aria-label="Close sharing dialog"
				class="grid size-9 flex-none cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/4 text-lg text-(--muted) disabled:cursor-not-allowed disabled:opacity-50"
				>×</button
			>
		</div>

		{#if editor.loading}
			<div class="my-10 flex flex-col items-center text-center" role="status">
				<span
					class="size-8 animate-[reel-spin_1.15s_linear_infinite] rounded-full border-2 border-white/15 border-t-(--rose)"
					aria-hidden="true"
				></span>
				<p class="mt-3 text-sm text-(--muted)">Loading shared friends…</p>
			</div>
		{:else if editor.loadedListId === list?.id && editor.loadedListId}
			<fieldset disabled={editor.saving} class="min-w-0 border-0 p-0">
				<div class="mt-6 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
					{#if editor.rows.length === 0}
						<div
							class="rounded-2xl border border-dashed border-white/12 bg-white/3 px-5 py-7 text-center"
						>
							<p class="text-sm font-bold text-white">Not shared yet</p>
							<p class="mt-1 text-xs text-(--muted)">Add a friend by their account email.</p>
						</div>
					{/if}
					{#each editor.rows as row, index (row.key)}
						<details
							bind:open={row.expanded}
							class="group overflow-hidden rounded-2xl border border-white/9 bg-white/3"
						>
							<summary
								class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:hidden [&::-webkit-details-marker]:hidden"
							>
								<span class="min-w-0 truncate text-sm font-bold text-white"
									>{row.email || `Friend ${index + 1}`}</span
								>
								<svg
									viewBox="0 0 24 24"
									class="size-4 flex-none text-(--muted) transition group-open:rotate-180"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
								>
							</summary>
							<div class="border-t border-white/7 p-4">
								<label for={`share-email-${row.key}`} class="mb-2 block text-xs font-bold"
									>Email</label
								>
								<input
									id={`share-email-${row.key}`}
									type="email"
									bind:value={row.email}
									placeholder="friend@example.com"
									aria-invalid={row.showErrors && Boolean(editor.rowError(row))}
									class="box-border w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#68616f] focus:border-(--purple) {row.showErrors &&
									editor.rowError(row)
										? 'border-[#ff5c74]/60'
										: 'border-white/12'}"
								/>
								{#if row.showErrors && editor.rowError(row)}
									<small class="mt-1.5 block text-[10px] text-[#ff8ca0]"
										>{editor.rowError(row)}</small
									>
								{/if}
								<div class="mt-3 flex justify-end">
									<button
										type="button"
										onclick={() => editor.removeEmail(row.key)}
										class="cursor-pointer rounded-xl border border-white/9 bg-white/4 px-3 py-2 text-xs font-bold text-(--muted) hover:text-white"
										>Remove friend</button
									>
								</div>
							</div>
						</details>
					{/each}
				</div>

				<button
					type="button"
					onclick={() => editor.addEmail()}
					class="mt-4 w-full cursor-pointer rounded-2xl border border-dashed border-white/16 bg-white/3 px-5 py-3.5 text-sm font-extrabold text-white hover:border-(--purple) hover:bg-(--purple)/7"
					>+ Add friend</button
				>
			</fieldset>
		{:else}
			<button
				type="button"
				class="mt-6 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold"
				onclick={() => {
					if (list) void editor.open(list.id);
				}}>Retry loading</button
			>
		{/if}

		{#if editor.message}
			<p
				class="mt-4 rounded-xl border border-[#ff5c74]/25 bg-[#ff5c74]/8 px-4 py-3 text-xs text-[#ff9aac]"
				role="alert"
			>
				{editor.message}
			</p>
		{/if}

		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				disabled={editor.saving}
				onclick={onClose}
				class="cursor-pointer rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
				>Cancel</button
			>
			<button
				type="button"
				disabled={!editor.canSave(list?.id)}
				onclick={save}
				class="inline-flex min-w-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-3 text-sm font-extrabold text-[#160b10] disabled:cursor-not-allowed disabled:opacity-50"
				>{#if editor.saving}<span
						class="size-3.5 animate-[reel-spin_.9s_linear_infinite] rounded-full border-2 border-[#160b10]/25 border-t-[#160b10]"
						aria-hidden="true"
					></span>Sending…{:else}Send{/if}</button
			>
		</div>
	</div>
</dialog>
