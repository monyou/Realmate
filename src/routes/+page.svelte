<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import PartyLobby from '#lib/components/party/PartyLobby.svelte';
	import PartyResult from '#lib/components/party/PartyResult.svelte';
	import SwipeDeck from '#lib/components/party/SwipeDeck.svelte';
	import { avatarColor, playerInitials } from '#lib/party-presentation.js';
	import Confetti from '#lib/components/Confetti.svelte';
	import RealmateLogo from '#lib/components/RealmateLogo.svelte';
	import {
		optimisticPlayerProgress,
		voteWasAcknowledged,
		type QueuedVote
	} from '#lib/optimistic-votes.js';
	import { fetchParty, PartyRequestError, type PartyAction } from '#lib/party-client.js';
	import { restorePartyState, type PartyResponse } from '#lib/party-response.js';
	import { isRoomId, normalizeRoomCode, partyRoomPath } from '#lib/party-room.js';
	import type { PartyState } from '#lib/types.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const guestWords = ['Popcorn', 'Velvet', 'Cosmic', 'Midnight', 'Neon', 'Golden'];
	const guestAnimals = ['Fox', 'Panda', 'Owl', 'Otter', 'Moth', 'Cat'];

	const noiseBackground =
		"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E\")";
	let party = $state.raw<PartyState | null>(null);
	const roomId = $derived(data.roomId);
	type RoomSession = {
		id: string;
		requests: AbortController;
		pollInFlight: boolean;
		heartbeatInFlight: boolean;
		voteQueueRunning: boolean;
	};
	let roomSession: RoomSession | null = null;
	let joinCode = $state('');
	let joinInput: HTMLInputElement;
	let joinButton = $state<HTMLButtonElement>();
	let codeError = $state('');
	let joinPartyOpen = $state(false);
	let playerId = $state('');
	let playerName = $state('');
	let connected = $state(false);
	let joinError = $state('');
	let voteError = $state('');
	let roomMissing = $state(false);
	let pendingVotes = $state<QueuedVote[]>([]);
	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

	const swipeCardKey = (state: PartyState | null, progress: number) => {
		const activeItem = state?.phase === 'playing' ? (state.deck[progress] ?? null) : null;
		return `${state?.roundId ?? 'no-round'}:${progress}:${activeItem?.id ?? 'no-card'}`;
	};

	const me = $derived(party?.players.find((player) => player.id === playerId));
	const activeProgress = $derived(optimisticPlayerProgress(party, playerId, pendingVotes));
	const currentItem = $derived(
		party?.phase === 'playing' && me ? (party.deck[activeProgress] ?? null) : null
	);
	const finishedSwiping = $derived(
		party?.phase === 'playing' && me && activeProgress >= party.deck.length
	);
	const readyToStart = $derived((party?.onlineCount ?? 0) >= 2);
	const currentCardKey = $derived(swipeCardKey(party, activeProgress));

	$effect(() => {
		const id = roomId;
		return untrack(() => setupRoom(id));
	});

	function setupRoom(id: string) {
		const session: RoomSession = {
			id,
			requests: new AbortController(),
			pollInFlight: false,
			heartbeatInFlight: false,
			voteQueueRunning: false
		};
		roomSession = session;
		party = null;
		pendingVotes = [];
		playerId = '';
		connected = false;
		joinError = '';
		voteError = '';
		roomMissing = false;
		joinPartyOpen = false;
		codeError = '';

		const guestSeed = crypto.randomUUID();
		playerName = makeGuestName(guestSeed);
		try {
			const savedSeed = localStorage.getItem('realmate-guest-seed') ?? guestSeed;
			localStorage.setItem('realmate-guest-seed', savedSeed);
			playerName = localStorage.getItem('realmate-player-name') ?? makeGuestName(savedSeed);
			localStorage.setItem('realmate-player-name', playerName);
		} catch {
			// Storage may be disabled. The server cookie still identifies this player.
		}
		joinCode = id;

		if (id) {
			void (async () => {
				const joined = await requestParty({ type: 'hello', name: playerName }, session);
				if (session.requests.signal.aborted || !joined) return;
				startPolling(session);
			})();
		}

		return () => {
			session.requests.abort();
			if (pollTimer) clearInterval(pollTimer);
			if (heartbeatTimer) clearInterval(heartbeatTimer);
			if (id && !roomMissing) {
				navigator.sendBeacon(
					`/api/party?room=${encodeURIComponent(id)}`,
					new Blob([JSON.stringify({ type: 'leave' })], { type: 'application/json' })
				);
			}
		};
	}

	function startPolling(session: RoomSession) {
		if (pollTimer) clearInterval(pollTimer);
		if (heartbeatTimer) clearInterval(heartbeatTimer);
		pollTimer = setInterval(() => void refreshParty(session), 900);
		heartbeatTimer = setInterval(() => void sendHeartbeat(session), 3_000);
	}

	function partyEndpoint(session: RoomSession) {
		const knownRound = party?.roundId ? `&knownRound=${encodeURIComponent(party.roundId)}` : '';
		return `/api/party?room=${encodeURIComponent(session.id)}${knownRound}`;
	}

	function applyResponse(response: PartyResponse) {
		if (!party || response.state.revision >= party.revision) {
			const state = restorePartyState(response.state, party);
			if (state.roundId !== party?.roundId || state.phase !== 'playing') {
				pendingVotes = [];
			}
			party = state;
		}
		playerId = response.playerId;
		connected = true;
	}

	async function requestParty(
		action?: PartyAction,
		session = roomSession
	): Promise<PartyResponse | null> {
		if (!session?.id || session.requests.signal.aborted) return null;
		try {
			const response = await fetchParty(partyEndpoint(session), session.requests.signal, action);
			if (session.requests.signal.aborted) return null;
			applyResponse(response);
			joinError = '';
			roomMissing = false;
			return response;
		} catch (error) {
			if (session.requests.signal.aborted) return null;
			roomMissing = error instanceof PartyRequestError && error.status === 404;
			if (roomMissing) {
				party = null;
				pendingVotes = [];
				session.requests.abort();
				if (pollTimer) clearInterval(pollTimer);
				if (heartbeatTimer) clearInterval(heartbeatTimer);
			}
			connected = false;
			joinError = error instanceof Error ? error.message : 'The watch party is unavailable.';
			return null;
		}
	}

	async function sendHeartbeat(session: RoomSession) {
		if (session.heartbeatInFlight || session.requests.signal.aborted) return;
		session.heartbeatInFlight = true;
		try {
			await requestParty({ type: 'hello', name: playerName }, session);
		} finally {
			session.heartbeatInFlight = false;
		}
	}

	async function refreshParty(session = roomSession) {
		if (!session?.id || session.pollInFlight || session.requests.signal.aborted) return;
		session.pollInFlight = true;
		try {
			await requestParty(undefined, session);
		} finally {
			session.pollInFlight = false;
		}
	}

	function retryJoin() {
		const session = roomSession;
		if (!session || session.requests.signal.aborted || session.heartbeatInFlight) return;
		void (async () => {
			await sendHeartbeat(session);
			if (!session.requests.signal.aborted && party) startPolling(session);
		})();
	}

	function returnHome() {
		window.location.href = window.location.pathname;
	}

	async function openJoinForm() {
		joinPartyOpen = true;
		await tick();
		joinInput?.focus();
	}

	async function closeJoinForm() {
		joinPartyOpen = false;
		codeError = '';
		await tick();
		joinButton?.focus();
	}

	function submitJoinParty(event: SubmitEvent) {
		event.preventDefault();
		if (!isRoomId(normalizeRoomCode(joinCode))) {
			codeError = 'Paste the complete room code from your host.';
			joinInput?.focus();
			return;
		}
		window.location.href = partyRoomPath(window.location.pathname, joinCode);
	}

	function makeGuestName(id: string) {
		let total = 0;
		for (const character of id) total += character.charCodeAt(0);
		return `${guestWords[total % guestWords.length]} ${guestAnimals[(total * 3 + 1) % guestAnimals.length]}`;
	}

	function sendStart() {
		if (readyToStart) void requestParty({ type: 'start' });
	}

	function sendAgain() {
		if (!party?.roundId) return;
		pendingVotes = [];
		void requestParty({ type: 'again', roundId: party.roundId });
	}

	function queueVote(liked: boolean) {
		if (!currentItem || !party?.roundId) return;
		voteError = '';
		const roundId = party.roundId;
		const itemId = currentItem.id;
		const position = activeProgress;
		pendingVotes = [...pendingVotes, { roundId, itemId, liked, position }];
		void flushVoteQueue();
	}

	async function flushVoteQueue() {
		const session = roomSession;
		if (!session?.id || session.requests.signal.aborted || session.voteQueueRunning) return;
		session.voteQueueRunning = true;

		try {
			while (!session.requests.signal.aborted && pendingVotes.length > 0) {
				const vote = pendingVotes[0];
				let response: PartyResponse | null = null;
				for (let attempt = 0; attempt < 2 && !response && pendingVotes[0] === vote; attempt += 1) {
					response = await requestParty(
						{
							type: 'vote',
							roundId: vote.roundId,
							itemId: vote.itemId,
							liked: vote.liked
						},
						session
					);
					if (session.requests.signal.aborted) return;
				}

				// A round change can replace the queue while this request is in flight.
				if (pendingVotes[0] !== vote) continue;

				if (!response) {
					pendingVotes = [];
					voteError = 'Your choices could not be saved. Please swipe again.';
					await refreshParty();
					break;
				}

				if (!voteWasAcknowledged(response.state, response.playerId, vote)) {
					pendingVotes = [];
					voteError = 'Your last choice was not saved. Please swipe it again.';
					break;
				}

				voteError = '';
				pendingVotes = pendingVotes.slice(1);
			}
		} finally {
			session.voteQueueRunning = false;
			if (!session.requests.signal.aborted && pendingVotes.length > 0) void flushVoteQueue();
		}
	}

	function displayedProgress(player: PartyState['players'][number]) {
		return player.id === playerId ? activeProgress : player.progress;
	}
</script>

{#snippet joinForm()}
	<form
		class="grid gap-3 rounded-3xl border border-white/9 bg-white/3 p-3 text-left min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-end"
		onsubmit={submitJoinParty}
	>
		<div class="min-w-0">
			<label
				for="join-room-code"
				class="mb-2 block px-1 text-[10px] font-bold tracking-[0.08em] text-(--muted) uppercase"
			>
				Room code
			</label>
			<input
				id="join-room-code"
				bind:value={joinCode}
				bind:this={joinInput}
				autocapitalize="none"
				aria-invalid={codeError ? 'true' : undefined}
				aria-describedby={codeError ? 'join-code-error' : undefined}
				oninput={() => (codeError = '')}
				onkeydown={(event) => {
					if (event.key === 'Escape' && joinPartyOpen) void closeJoinForm();
				}}
				type="text"
				inputmode="text"
				autocomplete="off"
				spellcheck="false"
				placeholder="Paste room code"
				class="w-full rounded-2xl border border-white/10 bg-black/18 px-4 py-3.5 font-mono text-sm text-white transition outline-none focus:border-(--purple)"
			/>
		</div>
		<button
			type="submit"
			disabled={!normalizeRoomCode(joinCode)}
			class="inline-flex w-full cursor-pointer items-center justify-between gap-6 rounded-2xl border border-white/12 bg-white/7 px-5 py-3.5 text-sm font-extrabold text-white transition hover:not-disabled:bg-white/11 disabled:cursor-not-allowed disabled:opacity-40 min-[560px]:w-auto"
		>
			<span>Join party</span><span aria-hidden="true">→</span>
		</button>
		{#if codeError}
			<p id="join-code-error" role="alert" class="text-sm text-[#ff8ca0] min-[560px]:col-span-2">
				{codeError}
			</p>
		{/if}
	</form>
{/snippet}

<svelte:head>
	<title>Realmate — Find tonight’s watch</title>
	<meta
		name="description"
		content="Swipe together, match on a movie or series, and stop debating what to watch."
	/>
	<meta name="theme-color" content="#0b0910" />
</svelte:head>

<div
	class="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-size-[52px_52px]"
>
	<div
		class="pointer-events-none fixed top-[-42vw] left-[-28vw] z-[-3] aspect-square w-[min(80vw,760px)] rounded-full bg-[#7c5cff] opacity-20 blur-[100px]"
	></div>
	<div
		class="pointer-events-none fixed right-[-42vw] bottom-[-45vw] z-[-3] aspect-square w-[min(80vw,760px)] rounded-full bg-[#ff3f66] opacity-20 blur-[100px]"
	></div>
	<div
		class="pointer-events-none fixed inset-0 z-[-1] opacity-[0.035]"
		style:background-image={noiseBackground}
	></div>

	{#if party?.phase === 'matched'}
		<Confetti />
	{/if}

	<header
		class="relative z-40 mx-auto flex w-[min(100%,1120px)] items-center justify-between px-5.5 pt-[max(20px,env(safe-area-inset-top))] pb-2 max-[380px]:px-4 min-[720px]:pt-7 [@media(max-height:760px)_and_(max-width:600px)]:pt-[max(14px,env(safe-area-inset-top))]"
	>
		<RealmateLogo />

		{#if roomId && !roomMissing}
			<div
				class="flex items-center gap-2 rounded-full border border-white/9 bg-white/4.5 px-3 py-2 text-[11px] font-bold tracking-[0.06em] uppercase backdrop-blur-md"
			>
				<span
					class="size-1.75 rounded-full bg-(--mint) shadow-[0_0_0_4px_rgba(66,232,193,0.12),0_0_12px_var(--mint)]"
					class:bg-[var(--gold)]={!connected}
					class:shadow-none={!connected}
				></span>
				<span>{connected ? `${party?.onlineCount ?? 0} online` : 'connecting'}</span>
			</div>
		{/if}
	</header>

	{#if joinError && party}
		<p
			role="status"
			class="relative z-2 mx-auto mt-3 max-w-130 px-5 text-center text-sm text-(--gold)"
		>
			{joinError} Reconnecting…
		</p>
	{/if}

	<main class="grid w-full flex-1 place-items-center">
		{#if !roomId}
			<section
				class="relative z-2 m-auto w-[min(100%,1120px)] px-5.5 pt-10 pb-14 text-center max-[380px]:px-4 min-[720px]:pt-16"
			>
				<h1
					class="m-0 mx-auto max-w-220 text-[clamp(36px,7vw,76px)] leading-[0.94] font-[850] tracking-[-0.04em] text-balance [&_em]:font-serif [&_em]:font-normal [&_em]:tracking-[-0.04em] [&_em]:text-(--rose)"
				>
					Find a movie or series<br /><em>everyone wants to watch.</em>
				</h1>

				<p class="mx-auto mt-6 max-w-155 text-[15px] leading-[1.7] text-(--muted)">
					Swipe through the same titles together. The first one everyone likes is tonight’s pick.
				</p>

				<div
					class="mx-auto mt-8 flex max-w-130 flex-col items-stretch justify-center gap-3 min-[520px]:flex-row"
				>
					<a
						href={data.user ? resolve('profile') : resolve('register')}
						class="inline-flex items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-4 text-sm font-extrabold text-[#160b10] no-underline shadow-[0_14px_34px_rgba(255,63,102,.24)] transition hover:-translate-y-0.5"
						><span>Host a watch party</span><span aria-hidden="true">→</span></a
					>
					{#if !joinPartyOpen}
						<button
							type="button"
							class="inline-flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-5 py-4 text-sm font-extrabold text-white transition hover:bg-white/9"
							bind:this={joinButton}
							onclick={openJoinForm}>Join with a code</button
						>
					{/if}
				</div>
				{#if joinPartyOpen}
					<div class="mx-auto mt-3 max-w-130">{@render joinForm()}</div>
				{/if}
				<p class="mt-3 text-sm text-(--muted)">Guests can join without an account.</p>
				{#if !data.user}
					<p class="mt-2 text-sm text-(--muted)">
						Already have an account? <a
							class="font-bold text-white underline underline-offset-4"
							href={resolve('login')}>Log in</a
						>
					</p>
				{/if}

				<div class="mx-auto mt-13 grid max-w-220 gap-3 text-left min-[700px]:grid-cols-3">
					<div class="rounded-3xl border border-white/8 bg-white/3 p-5">
						<span class="text-[10px] font-extrabold tracking-[0.16em] text-(--purple) uppercase"
							>01 · Curate</span
						>
						<h2 class="mt-3 text-base font-extrabold">Build private lists</h2>
						<p class="mt-2 text-xs leading-relaxed text-(--muted)">
							Organize movies and series by mood, genre, or group.
						</p>
					</div>
					<div class="rounded-3xl border border-white/8 bg-white/3 p-5">
						<span class="text-[10px] font-extrabold tracking-[0.16em] text-(--rose) uppercase"
							>02 · Invite</span
						>
						<h2 class="mt-3 text-base font-extrabold">Share one code</h2>
						<p class="mt-2 text-xs leading-relaxed text-(--muted)">
							Choose any combination of lists and invite people into a live room.
						</p>
					</div>
					<div class="rounded-3xl border border-white/8 bg-white/3 p-5">
						<span class="text-[10px] font-extrabold tracking-[0.16em] text-(--mint) uppercase"
							>03 · Match</span
						>
						<h2 class="mt-3 text-base font-extrabold">Swipe to agreement</h2>
						<p class="mt-2 text-xs leading-relaxed text-(--muted)">
							The first unanimous like becomes tonight’s watch.
						</p>
					</div>
				</div>
			</section>
		{:else if joinError && !party}
			<section
				class="relative z-2 m-auto w-[min(100%,560px)] px-5.5 pt-7 pb-10.5 text-center max-[380px]:px-4"
			>
				<div
					class="mx-auto mb-6 grid size-20 place-items-center rounded-[26px] border border-white/10 bg-white/4 text-3xl text-(--gold)"
				>
					!
				</div>

				<h1 class="m-0 text-[clamp(38px,10vw,58px)] leading-none font-[850] tracking-[-0.06em]">
					{roomMissing ? 'No such party exists' : 'Party unavailable'}
				</h1>

				<p class="mx-auto mt-5 max-w-105 text-[15px] leading-[1.65] text-(--muted)" role="alert">
					{roomMissing ? 'This party room does not exist or is no longer available.' : joinError}
				</p>
				{#if roomMissing}
					<div class="mx-auto mt-5 max-w-130">{@render joinForm()}</div>
				{/if}
				{#if !roomMissing}
					<button
						class="mt-5 rounded-xl border border-white/12 px-5 py-3 font-bold"
						onclick={retryJoin}>Try joining again</button
					>
				{/if}
				<button
					class="mt-7 cursor-pointer rounded-[15px] border border-white/12 bg-white/7 px-5 py-3.5 font-bold text-(--ink) transition-colors hover:bg-white/11"
					onclick={returnHome}
				>
					Return home
				</button>
			</section>
		{:else if !party}
			<section
				class="relative z-2 m-auto flex w-[min(100%,620px)] flex-col items-center gap-5 px-5.5 pt-7 pb-10.5 text-center text-(--muted) max-[380px]:px-4"
			>
				<div
					class="relative size-15.5 animate-[reel-spin_1.8s_linear_infinite] rounded-full border-2 border-white/15 border-t-(--rose) before:absolute before:top-2.5 before:left-2.5 before:size-3 before:rounded-full before:bg-white/12 before:content-[''] after:absolute after:top-2.5 after:right-2.5 after:size-3 after:rounded-full after:bg-white/12 after:content-['']"
				>
					<span
						class="before:absolute before:bottom-2.25 before:left-5.75 before:size-3 before:rounded-full before:bg-white/12 before:content-['']"
					></span>
				</div>
				<p>Joining the watch party…</p>
			</section>
		{:else if party.phase === 'lobby'}
			<PartyLobby {party} {playerId} roomCode={roomId} onstart={sendStart} />
		{:else if party.phase === 'playing' && me && !finishedSwiping}
			{#key currentCardKey}
				<SwipeDeck {party} {activeProgress} {voteError} onvote={queueVote} />
			{/key}
		{:else if party.phase === 'playing' && me && finishedSwiping}
			<section
				class="relative z-2 m-auto w-[min(100%,620px)] max-w-135 px-5.5 pt-7 pb-10.5 text-center max-[380px]:px-4"
			>
				<div
					class="relative mx-auto mb-7 grid size-24.5 place-items-center rounded-full border border-white/8 before:absolute before:-inset-3.5 before:rounded-full before:border before:border-[rgba(124,92,255,0.12)] before:content-[''] after:absolute after:-inset-7 after:rounded-full after:border after:border-[rgba(124,92,255,0.12)] after:content-[''] [&_i]:absolute [&_i]:-top-1 [&_i]:left-[calc(50%-4px)] [&_i]:size-2 [&_i]:origin-[4px_53px] [&_i]:animate-[orbit_2.2s_linear_infinite] [&_i]:rounded-full [&_i]:bg-(--purple) [&_i]:shadow-[0_0_16px_var(--purple)] [&_i:nth-child(2)]:top-1.75 [&_i:nth-child(2)]:origin-[4px_42px] [&_i:nth-child(2)]:animate-[orbit_1.35s_linear_infinite_reverse] [&_i:nth-child(2)]:bg-(--rose)"
				>
					<i></i><i></i><span
						class="grid size-14 place-items-center rounded-[19px] bg-[linear-gradient(145deg,var(--mint),#90f5dc)] text-2xl text-[#110e16] shadow-[0_0_50px_rgba(66,232,193,0.22)]"
						>✓</span
					>
				</div>
				<div
					class="mb-5 inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.18em] text-[#d7d0e2] uppercase"
				>
					<span class="h-px w-6 bg-(--rose) shadow-[0_0_10px_var(--rose)]"></span>
					{pendingVotes.length > 0 ? 'Saving your choices' : 'You’re all caught up'}
				</div>
				<h1
					class="m-0 text-[clamp(42px,11vw,68px)] leading-[0.97] font-[850] tracking-[-0.065em] [&_em]:font-serif [&_em]:font-normal [&_em]:tracking-[-0.055em] [&_em]:text-(--rose)"
				>
					Cards down.<br /><em
						>{pendingVotes.length > 0 ? 'Saving your picks.' : 'Waiting on the crew.'}</em
					>
				</h1>
				<p class="mx-auto mt-5.5 max-w-127.5 text-[15px] leading-[1.65] text-(--muted)">
					{pendingVotes.length > 0
						? 'You can stay here while the last choices sync in the background.'
						: 'Your votes are locked in. This screen will update the moment everyone finishes.'}
				</p>

				<div
					class="mx-auto mt-8 flex max-w-107.5 flex-col gap-2.25 rounded-3xl border border-white/8 bg-white/[0.035] p-2.25 backdrop-blur-[18px]"
				>
					{#each party.players as player (player.id)}
						<div
							class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[17px] bg-white/2.5 p-2.5 text-left"
						>
							<span
								class={`grid size-9.5 flex-none place-items-center rounded-[13px] border-2 border-white/12 text-[11px] font-[850] tracking-[-0.02em] shadow-[inset_0_1px_rgba(255,255,255,0.18)] ${avatarColor(player.avatar)}`}
								>{playerInitials(player.name)}</span
							>
							<div class="flex min-w-0 flex-col gap-0.75">
								<strong class="overflow-hidden text-xs text-ellipsis whitespace-nowrap"
									>{player.id === playerId ? 'You' : player.name}</strong
								>
								<span class="text-[10px] text-(--muted)"
									>{Math.min(displayedProgress(player), player.total)} of {player.total}</span
								>
							</div>
							<i
								class="grid h-7.5 min-w-9.5 place-items-center rounded-[10px] bg-white/5 text-[9px] font-extrabold text-[#918a98] not-italic"
								class:bg-[rgba(66,232,193,0.09)]={displayedProgress(player) >= player.total}
								class:text-[var(--mint)]={displayedProgress(player) >= player.total}
							>
								{displayedProgress(player) >= player.total
									? '✓'
									: `${Math.round((displayedProgress(player) / player.total) * 100)}%`}
							</i>
						</div>
					{/each}
				</div>
			</section>
		{:else if party.phase === 'playing'}
			<section
				class="relative z-2 m-auto w-[min(100%,620px)] max-w-135 px-5.5 pt-7 pb-10.5 text-center max-[380px]:px-4"
			>
				<div
					class="mx-auto mb-7 grid size-20.5 place-items-center rounded-[27px] border border-white/12 bg-[linear-gradient(145deg,rgba(124,92,255,0.22),rgba(255,92,116,0.1))] shadow-[0_20px_50px_rgba(0,0,0,0.26)]"
				>
					<span class="ml-1 text-[28px] text-(--purple)">▶</span>
				</div>
				<div
					class="mb-5 inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.18em] text-[#d7d0e2] uppercase"
				>
					<span class="h-px w-6 bg-(--rose) shadow-[0_0_10px_var(--rose)]"></span> Round in progress
				</div>
				<h1
					class="m-0 text-[clamp(42px,11vw,68px)] leading-[0.97] font-[850] tracking-[-0.065em] [&_em]:font-serif [&_em]:font-normal [&_em]:tracking-[-0.055em] [&_em]:text-(--rose)"
				>
					You caught the<br /><em>middle of the movie.</em>
				</h1>
				<p class="mx-auto mt-5.5 max-w-127.5 text-[15px] leading-[1.65] text-(--muted)">
					You’ll join the room automatically when the current group finishes.
				</p>
				<div
					class="mx-auto mt-8 flex max-w-107.5 flex-col gap-2.25 rounded-3xl border border-white/8 bg-white/[0.035] p-2.25 backdrop-blur-[18px]"
				>
					{#each party.players as player (player.id)}
						<div
							class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[17px] bg-white/2.5 p-2.5 text-left"
						>
							<span
								class={`grid size-9.5 flex-none place-items-center rounded-[13px] border-2 border-white/12 text-[11px] font-[850] tracking-[-0.02em] shadow-[inset_0_1px_rgba(255,255,255,0.18)] ${avatarColor(player.avatar)}`}
								>{playerInitials(player.name)}</span
							>
							<div class="flex min-w-0 flex-col gap-0.75">
								<strong class="overflow-hidden text-xs text-ellipsis whitespace-nowrap"
									>{player.name}</strong
								><span class="text-[10px] text-(--muted)">Choosing now</span>
							</div>
							<i
								class="grid h-7.5 min-w-9.5 place-items-center rounded-[10px] bg-white/5 text-[9px] font-extrabold text-[#918a98] not-italic"
								>{player.progress}/{player.total}</i
							>
						</div>
					{/each}
				</div>
			</section>
		{:else}
			<PartyResult {party} onagain={sendAgain} />
		{/if}
	</main>

	<footer
		class="relative z-2 flex items-center justify-center gap-2.5 px-5 pt-2 pb-[max(18px,env(safe-area-inset-bottom))] text-[11px] tracking-[0.04em] text-(--muted)"
	>
		<span class="font-extrabold">realmate</span>
		<i class="size-0.75 rounded-full bg-[#514b57]"></i>
		<p class="m-0">Less browsing. More watching.</p>
	</footer>
</div>
