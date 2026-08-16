<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import ReelmateLogo from '$lib/components/ReelmateLogo.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let selected = $state<string[]>([]);

	const formatDate = (value: string) =>
		new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
			new Date(value)
		);
</script>

<svelte:head>
	<title>Your lists — Reelmate</title>
	<meta name="description" content="Manage your Reelmate movie and series lists." />
</svelte:head>

<div class="relative isolate min-h-dvh overflow-hidden bg-[#0b0910] text-(--ink)">
	<div
		class="pointer-events-none fixed -top-60 -left-44 -z-1 size-160 rounded-full bg-[#7c5cff]/18 blur-[120px]"
	></div>
	<div
		class="pointer-events-none fixed -right-44 -bottom-64 -z-1 size-150 rounded-full bg-[#ff3f66]/14 blur-[120px]"
	></div>

	<header class="border-b border-white/7 px-5 py-5 backdrop-blur-xl">
		<div class="mx-auto flex w-[min(100%,1120px)] items-center justify-between gap-4">
			<ReelmateLogo />
			<div class="flex items-center gap-3">
				<span class="hidden max-w-56 truncate text-xs text-(--muted) min-[600px]:block"
					>{data.user.email}</span
				>
				<form method="POST" action="?/logout">
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
			<a
				href={resolve('/profile/lists/new')}
				class="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-3.5 text-sm font-extrabold text-[#160b10] no-underline shadow-[0_12px_28px_rgba(255,63,102,.2)] transition hover:-translate-y-0.5"
				><span class="text-lg">+</span> New list</a
			>
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
			<form method="POST" action="?/startParty" class="mt-10">
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
					class="overflow-hidden rounded-[26px] border border-white/9 bg-[linear-gradient(145deg,rgba(28,24,38,.9),rgba(15,13,20,.96))] shadow-[0_22px_70px_rgba(0,0,0,.25)]"
				>
					<div
						class="hidden grid-cols-[32px_minmax(0,1fr)_90px_120px_40px] gap-4 border-b border-white/7 px-5 py-3 text-[10px] font-extrabold tracking-[0.14em] text-(--muted) uppercase min-[720px]:grid"
					>
						<span></span><span>List</span><span>Titles</span><span>Last updated</span><span></span>
					</div>
					{#each data.lists as list (list.id)}
						<div
							class="grid grid-cols-[34px_minmax(0,1fr)_auto_38px] items-center gap-3 border-b border-white/6 px-4 py-5 transition last:border-0 hover:bg-white/3 min-[720px]:grid-cols-[32px_minmax(0,1fr)_90px_120px_40px] min-[720px]:gap-4 min-[720px]:px-5"
						>
							<input
								type="checkbox"
								name="listId"
								value={list.id}
								bind:group={selected}
								aria-label={`Select ${list.name}`}
								class="size-4.5 cursor-pointer accent-[#ff5c74]"
							/>
							<span class="min-w-0"
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
						</div>
					{/each}
				</div>
			</form>
		{/if}
	</main>
</div>
