<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { PartyState } from '#lib/types.js';
	import { avatarColor, playerInitials } from '#lib/party-presentation.js';
	let {
		party,
		playerId,
		roomCode,
		onstart
	}: {
		party: PartyState;
		playerId: string;
		roomCode: string;
		onstart: () => void;
	} = $props();
	const readyToStart = $derived(party.onlineCount >= 2);
	let copyStatus = $state<'idle' | 'copied' | 'failed'>('idle');
	let copyResetTimer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	onDestroy(() => {
		disposed = true;
		if (copyResetTimer) clearTimeout(copyResetTimer);
	});
	async function copyRoomCode() {
		if (!roomCode) return;
		if (copyResetTimer) clearTimeout(copyResetTimer);
		try {
			if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.');
			await navigator.clipboard.writeText(roomCode);
			if (disposed) return;
			copyStatus = 'copied';
		} catch {
			if (disposed) return;
			copyStatus = 'failed';
		}
		copyResetTimer = setTimeout(() => (copyStatus = 'idle'), 2_400);
	}
</script>

<section
	class="relative z-2 m-auto w-[min(100%,620px)] px-5.5 pt-7 pb-10.5 text-center max-[380px]:px-4 min-[720px]:pt-10.5 [@media(max-height:760px)_and_(max-width:600px)]:pt-3"
>
	<div
		class="mb-5 inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.18em] text-[#d7d0e2] uppercase"
	>
		<span class="h-px w-6 bg-(--rose) shadow-[0_0_10px_var(--rose)]"></span> One room. One choice.
	</div>
	<h1
		class="m-0 text-[clamp(42px,11vw,68px)] leading-[0.97] font-[850] tracking-[-0.065em] [&_em]:font-serif [&_em]:font-normal [&_em]:tracking-[-0.055em] [&_em]:text-(--rose) [@media(max-height:760px)_and_(max-width:600px)]:text-[39px]"
	>
		Tonight’s watch,<br /><em>decided together.</em>
	</h1>
	<p
		class="mx-auto mt-5.5 max-w-127.5 text-[15px] leading-[1.65] text-(--muted) [@media(max-height:760px)_and_(max-width:600px)]:mt-3.5"
	>
		Swipe through movies and series. The instant everyone likes the same title, the search is over.
	</p>

	<div
		class="relative mx-auto mt-8.5 w-[min(100%,470px)] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(30,26,40,0.92),rgba(16,14,22,0.96))] p-5.5 text-left shadow-[0_28px_80px_rgba(0,0,0,0.32),inset_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[20px] max-[380px]:rounded-[23px] max-[380px]:p-4.5 min-[720px]:p-6.25 [@media(max-height:760px)_and_(max-width:600px)]:mt-5.5"
	>
		<div
			class="absolute -top-30 -right-22.5 size-60 rounded-full bg-[rgba(124,92,255,0.2)] blur-[48px]"
		></div>
		<div class="relative flex items-center justify-between">
			<div class="flex flex-col gap-1.25">
				<span class="text-[10px] font-bold tracking-[0.15em] text-(--muted) uppercase"
					>Your watch party</span
				>
				<strong class="text-[21px] tracking-[-0.035em]"
					>{party.onlineCount} {party.onlineCount === 1 ? 'person' : 'people'} here</strong
				>
			</div>
			<div
				class="flex size-10 items-end gap-0.75 rounded-xl bg-[rgba(66,232,193,0.08)] p-2.5 [&_i]:block [&_i]:w-1 [&_i]:rounded-[3px] [&_i]:bg-(--mint) [&_i]:shadow-[0_0_8px_rgba(66,232,193,0.4)] [&_i:nth-child(1)]:h-1.75 [&_i:nth-child(2)]:h-3.25 [&_i:nth-child(3)]:h-4.75"
				aria-label="Live room"
			>
				<i></i><i></i><i></i>
			</div>
		</div>

		<div class="relative mt-5 rounded-[17px] border border-white/8 bg-black/15 p-2.25">
			<label
				for="room-code"
				class="mb-2 block px-1 text-[9px] font-bold tracking-[0.14em] text-(--muted) uppercase"
				>Party room code</label
			>
			<div class="flex gap-2">
				<input
					id="room-code"
					value={roomCode}
					readonly
					aria-label="Watch party room code"
					class="min-w-0 flex-1 rounded-xl border border-white/9 bg-white/4 px-3 py-2.75 font-mono text-[11px] tracking-[0.03em] text-[#c8c1d2] outline-none focus:border-[rgba(124,92,255,0.7)]"
				/>
				<button
					type="button"
					class="min-w-20 cursor-pointer rounded-xl border-0 bg-[linear-gradient(120deg,var(--purple),#9a79ff)] px-3 py-2.75 text-[11px] font-extrabold text-white shadow-[0_8px_22px_rgba(124,92,255,0.24)] transition-transform hover:-translate-y-px active:translate-y-px"
					onclick={() => void copyRoomCode()}
				>
					{copyStatus === 'copied'
						? 'Copied ✓'
						: copyStatus === 'failed'
							? 'Try again'
							: 'Copy code'}
				</button>
			</div>
			{#if copyStatus === 'failed'}
				<p class="mt-2 px-1 text-[10px] text-[#ff9bad]" role="status">
					Clipboard access was blocked. Select the code and copy it manually.
				</p>
			{/if}
		</div>

		<div
			class="mt-4.5 flex scrollbar-none gap-3.5 overflow-x-auto border-y border-white/6 py-4.25 [&::-webkit-scrollbar]:hidden"
			aria-label="People in the room"
		>
			{#each party.players as player (player.id)}
				<div class="flex min-w-13.75 flex-none flex-col items-center gap-1.75" title={player.name}>
					<span
						class={`grid size-10.5 flex-none place-items-center rounded-[15px] border-2 border-white/12 text-[11px] font-[850] tracking-[-0.02em] shadow-[inset_0_1px_rgba(255,255,255,0.18)] ${avatarColor(player.avatar)}`}
						>{playerInitials(player.name)}</span
					>
					<small
						class="max-w-16 overflow-hidden text-[10px] font-[650] text-ellipsis whitespace-nowrap text-[#c8c1d2]"
						>{player.id === playerId ? 'You' : player.name.split(' ')[0]}</small
					>
				</div>
			{/each}
			{#if party.players.length === 1}
				<div class="flex min-w-13.75 flex-none flex-col items-center gap-1.75 opacity-70">
					<span
						class="grid size-10.5 flex-none place-items-center rounded-[15px] border border-dashed border-white/18 bg-white/3 text-[22px] font-light tracking-[-0.02em] text-[#8a8492]"
						>+</span
					>
					<small
						class="max-w-16 overflow-hidden text-[10px] font-[650] text-ellipsis whitespace-nowrap text-[#c8c1d2]"
						>Waiting</small
					>
				</div>
			{/if}
		</div>

		{#if party.message}
			<p class="mt-3.5 text-center text-xs text-(--gold)">{party.message}</p>
		{/if}

		<button
			class="relative mt-4.5 flex w-full cursor-pointer items-center justify-between rounded-[17px] border-0 px-5 py-4.25 font-extrabold tracking-[-0.02em] text-[#120a0f] shadow-[0_14px_34px_rgba(255,63,102,0.24),inset_0_1px_rgba(255,255,255,0.35)] transition-[transform,box-shadow,opacity] duration-150 ease-in-out hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-[0_18px_42px_rgba(255,63,102,0.32)] active:not-disabled:translate-y-px active:not-disabled:scale-[0.99] enabled:bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] disabled:cursor-not-allowed disabled:bg-white/7.5 disabled:text-[#89838f] disabled:shadow-none [&_b]:text-[23px] [&_b]:leading-none"
			disabled={!readyToStart}
			onclick={onstart}
		>
			<span>{readyToStart ? 'Start swiping' : 'Waiting for someone else'}</span>
			<b aria-hidden="true">→</b>
		</button>
		<p
			class="mt-3.25 flex items-center justify-center gap-1.75 text-center text-[10px] text-[#817a89]"
		>
			<span class="text-(--gold)">✦</span>
			{readyToStart
				? 'Anyone can start — it begins for everyone'
				: 'Share the room code with at least one person'}
		</p>
	</div>
</section>
