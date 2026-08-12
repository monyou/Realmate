<script lang="ts">
	import { onMount } from 'svelte';
	import Confetti from '$lib/components/Confetti.svelte';
	import type { MediaItem, PartyState } from '$lib/types';

	const guestWords = ['Popcorn', 'Velvet', 'Cosmic', 'Midnight', 'Neon', 'Golden'];
	const guestAnimals = ['Fox', 'Panda', 'Owl', 'Otter', 'Moth', 'Cat'];
	const avatarColors = [
		'bg-[linear-gradient(145deg,#ff7c67,#df345d)]',
		'bg-[linear-gradient(145deg,#8b7dff,#5a3fd1)]',
		'bg-[linear-gradient(145deg,#43ddb8,#168b83)]',
		'bg-[linear-gradient(145deg,#f6c860,#e47d3e)]',
		'bg-[linear-gradient(145deg,#59b8ff,#3154cc)]',
		'bg-[linear-gradient(145deg,#e879f9,#9b3fc2)]'
	];
	const noiseBackground =
		"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E\")";

	let party = $state<PartyState | null>(null);
	let playerId = $state('');
	let playerName = $state('');
	let connected = $state(false);
	let dragX = $state(0);
	let dragging = $state(false);
	let leaving = $state(false);
	let dragStart = 0;
	let previousCardKey = '';
	let voteSendTimer: ReturnType<typeof setTimeout> | undefined;
	let voteFallback: ReturnType<typeof setTimeout> | undefined;

	const me = $derived(party?.players.find((player) => player.id === playerId));
	const currentItem = $derived(
		party?.phase === 'playing' && me ? (party.deck[me.progress] ?? null) : null
	);
	const nextItem = $derived(
		party?.phase === 'playing' && me ? (party.deck[me.progress + 1] ?? null) : null
	);
	const thirdItem = $derived(
		party?.phase === 'playing' && me ? (party.deck[me.progress + 2] ?? null) : null
	);
	const finishedSwiping = $derived(
		party?.phase === 'playing' && me && me.progress >= party.deck.length
	);
	const readyToStart = $derived((party?.onlineCount ?? 0) >= 2);
	const yesStrength = $derived(Math.min(1, Math.max(0, dragX / 110)));
	const noStrength = $derived(Math.min(1, Math.max(0, -dragX / 110)));
	const cardTransform = $derived(
		`transform: translate3d(${dragX}px, 0, 0) rotate(${dragX / 19}deg); transition: ${dragging ? 'none' : 'transform 260ms cubic-bezier(.2,.9,.2,1)'};`
	);

	$effect(() => {
		const activeCardKey = `${party?.roundId ?? 'no-round'}:${currentItem?.id ?? 'no-card'}`;
		if (activeCardKey !== previousCardKey) {
			previousCardKey = activeCardKey;
			if (voteSendTimer) clearTimeout(voteSendTimer);
			if (voteFallback) clearTimeout(voteFallback);
			dragX = 0;
			leaving = false;
		}
	});

	onMount(() => {
		playerId = localStorage.getItem('reelmate-player-id') ?? crypto.randomUUID();
		localStorage.setItem('reelmate-player-id', playerId);

		playerName = localStorage.getItem('reelmate-player-name') ?? makeGuestName(playerId);
		localStorage.setItem('reelmate-player-name', playerName);

		const hot = import.meta.hot;
		if (!hot) return;

		const receiveState = (nextState: PartyState) => {
			party = nextState;
			connected = true;
		};
		hot.on('reel:state', receiveState);
		hot.send('reel:hello', { playerId, name: playerName });

		return () => {
			hot.off('reel:state', receiveState);
			if (voteSendTimer) clearTimeout(voteSendTimer);
			if (voteFallback) clearTimeout(voteFallback);
		};
	});

	function makeGuestName(id: string) {
		let total = 0;
		for (const character of id) total += character.charCodeAt(0);
		return `${guestWords[total % guestWords.length]} ${guestAnimals[(total * 3 + 1) % guestAnimals.length]}`;
	}

	function sendStart() {
		if (readyToStart) import.meta.hot?.send('reel:start', { playerId });
	}

	function sendAgain() {
		if (!party?.roundId) return;
		if (voteSendTimer) clearTimeout(voteSendTimer);
		if (voteFallback) clearTimeout(voteFallback);
		dragX = 0;
		leaving = false;
		import.meta.hot?.send('reel:again', { playerId, roundId: party.roundId });
	}

	function decide(liked: boolean) {
		if (!currentItem || !party?.roundId || leaving) return;
		leaving = true;
		dragging = false;
		dragX = (liked ? 1 : -1) * Math.max(window.innerWidth, 520);
		const itemId = currentItem.id;
		const roundId = party.roundId;
		voteSendTimer = setTimeout(
			() => import.meta.hot?.send('reel:vote', { playerId, roundId, itemId, liked }),
			190
		);
		voteFallback = setTimeout(() => {
			dragX = 0;
			leaving = false;
		}, 1_200);
	}

	function pointerDown(event: PointerEvent) {
		if (leaving) return;
		dragging = true;
		dragStart = event.clientX - dragX;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function pointerMove(event: PointerEvent) {
		if (!dragging || leaving) return;
		dragX = event.clientX - dragStart;
	}

	function pointerUp() {
		if (!dragging) return;
		dragging = false;
		if (Math.abs(dragX) >= 88) decide(dragX > 0);
		else dragX = 0;
	}

	function handleKey(event: KeyboardEvent) {
		if (party?.phase !== 'playing' || !currentItem || leaving) return;
		if (event.key === 'ArrowLeft') decide(false);
		if (event.key === 'ArrowRight') decide(true);
	}

	function playerInitials(name: string) {
		return name
			.split(' ')
			.map((word) => word[0])
			.join('')
			.slice(0, 2);
	}

	function avatarColor(avatar: number) {
		return avatarColors[avatar % avatarColors.length];
	}

	function mediaLabel(item: MediaItem) {
		return item.type === 'movie' ? 'Movie' : 'Series';
	}

	function ratingLabel(item: MediaItem) {
		return item.imdbRating.toFixed(1);
	}
</script>

<svelte:head>
	<title>Reelmate — Find tonight’s watch</title>
	<meta
		name="description"
		content="Swipe together, match on a movie or series, and stop debating what to watch."
	/>
	<meta name="theme-color" content="#0b0910" />
</svelte:head>

<svelte:window onkeydown={handleKey} />

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
		<div class="flex items-center gap-2.5" aria-label="Reelmate home">
			<span
				class="relative grid size-7 rotate-[-8deg] place-items-center rounded-full border-2 border-(--rose) shadow-[0_0_24px_rgba(255,92,116,0.35)] before:absolute before:top-1 before:left-1.5 before:size-1 before:rounded-full before:bg-(--rose) before:content-[''] after:absolute after:top-1.25 after:right-1.25 after:size-1 after:rounded-full after:bg-(--rose) after:content-['']"
				><span
					class="size-2 rounded-full bg-(--rose) before:absolute before:bottom-1 before:left-1.5 before:size-1 before:rounded-full before:bg-(--rose) before:content-['']"
				></span></span
			>
			<span class="text-lg font-extrabold tracking-[-0.04em]">reelmate</span>
		</div>

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
	</header>

	<main class="grid w-full flex-1 place-items-center">
		{#if !party}
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
					Swipe through movies and series. The instant everyone likes the same title, the search is
					over.
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

					<div
						class="mt-6 flex scrollbar-none gap-3.5 overflow-x-auto border-y border-white/6 py-4.25 [&::-webkit-scrollbar]:hidden"
						aria-label="People in the room"
					>
						{#each party.players as player (player.id)}
							<div
								class="flex min-w-13.75 flex-none flex-col items-center gap-1.75"
								title={player.name}
							>
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
						class="relative mt-4.5 flex w-full cursor-pointer items-center justify-between rounded-[17px] border-0 enabled:bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-4.25 font-extrabold tracking-[-0.02em] text-[#120a0f] shadow-[0_14px_34px_rgba(255,63,102,0.24),inset_0_1px_rgba(255,255,255,0.35)] transition-[transform,box-shadow,opacity] duration-150 ease-in-out hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-[0_18px_42px_rgba(255,63,102,0.32)] active:not-disabled:translate-y-px active:not-disabled:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/7.5 disabled:text-[#89838f] disabled:shadow-none [&_b]:text-[23px] [&_b]:leading-none"
						disabled={!readyToStart}
						onclick={sendStart}
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
							: 'Share this page with at least one person'}
					</p>
				</div>
			</section>
		{:else if party.phase === 'playing' && me && !finishedSwiping}
			<section
				class="relative z-2 m-auto w-[min(100%,470px)] px-5.5 pt-3.5 pb-10.5 text-center max-[380px]:px-4 min-[720px]:pt-5.5 [@media(max-height:760px)_and_(max-width:600px)]:pt-1 [@media(max-height:760px)_and_(max-width:600px)]:pb-5"
			>
				<div class="mx-0.75 mb-3 flex items-center justify-between">
					<div class="flex pl-2">
						{#each party.players.slice(0, 4) as player (player.id)}
							<span
								class={`-ml-2 grid size-7.5 flex-none place-items-center rounded-[10px] border-2 border-[#0b0910] text-[8px] font-[850] tracking-[-0.02em] shadow-[inset_0_1px_rgba(255,255,255,0.18)] ${avatarColor(player.avatar)}`}
								title={player.name}
							>
								{playerInitials(player.name)}
							</span>
						{/each}
					</div>
					<div
						class="flex items-baseline gap-1.25 text-xs font-bold text-[#787180] [&_b]:text-base [&_b]:text-(--ink)"
					>
						<b>{me.progress + 1}</b><span>/</span>{party.deck.length}
					</div>
				</div>
				<div class="mb-5 h-0.75 overflow-hidden rounded-[99px] bg-white/7">
					<span
						class="block h-full rounded-[inherit] bg-[linear-gradient(90deg,var(--rose),var(--purple))] shadow-[0_0_12px_rgba(255,92,116,0.5)] transition-[width] duration-300 ease-in-out"
						style={`width:${(me.progress / party.deck.length) * 100}%`}
					></span>
				</div>

				<div
					class="relative mx-auto h-[min(58vh,560px)] min-h-107.5 w-[min(100%,380px)] perspective-[1000px] max-[380px]:min-h-97.5 min-[720px]:h-[min(62vh,575px)] [@media(max-height:760px)_and_(max-width:600px)]:h-[52vh] [@media(max-height:760px)_and_(max-width:600px)]:min-h-90"
					aria-live="polite"
				>
					{#if thirdItem}
						<div
							class="absolute inset-0 translate-y-4.75 scale-[0.91] overflow-hidden rounded-[28px] border border-white/14 bg-[linear-gradient(145deg,#282131,#15121a)] opacity-30 shadow-[0_25px_60px_rgba(0,0,0,0.48),inset_0_1px_rgba(255,255,255,0.08)] max-[380px]:rounded-3xl"
							aria-hidden="true"
						></div>
					{/if}
					{#if nextItem}
						<div
							class="absolute inset-0 translate-y-2.5 scale-[0.955] overflow-hidden rounded-[28px] border border-white/14 bg-[linear-gradient(145deg,#282131,#15121a)] opacity-65 shadow-[0_25px_60px_rgba(0,0,0,0.48),inset_0_1px_rgba(255,255,255,0.08)] max-[380px]:rounded-3xl"
							aria-hidden="true"
						>
							<img
								class="pointer-events-none size-full object-cover select-none"
								src={nextItem.img}
								alt=""
							/>
						</div>
					{/if}
					{#if currentItem}
						{#key currentItem.id}
							<article
								class="absolute inset-0 z-3 cursor-grab touch-none overflow-hidden rounded-[28px] border border-white/14 bg-[linear-gradient(145deg,#282131,#15121a)] shadow-[0_25px_60px_rgba(0,0,0,0.48),inset_0_1px_rgba(255,255,255,0.08)] will-change-transform max-[380px]:rounded-3xl"
								class:cursor-grabbing={dragging}
								style={cardTransform}
								onpointerdown={pointerDown}
								onpointermove={pointerMove}
								onpointerup={pointerUp}
								onpointercancel={pointerUp}
							>
								<img
									class="pointer-events-none size-full object-cover select-none"
									src={currentItem.img}
									alt={`${currentItem.title} poster`}
									draggable="false"
								/>
								<div
									class="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,8,0.02)_40%,rgba(5,4,8,0.42)_67%,rgba(5,4,8,0.97)_100%)]"
								></div>
								<div
									class="absolute top-9.5 right-6 z-3 rotate-10 rounded-lg border-4 border-current px-3 py-1.75 pb-1.25 text-[25px] font-[950] tracking-[0.02em] text-(--rose) [text-shadow:0_2px_12px_rgba(0,0,0,0.3)]"
									style={`opacity:${noStrength}`}
								>
									PASS
								</div>
								<div
									class="absolute top-9.5 left-6 z-3 rotate-[-10deg] rounded-lg border-4 border-current px-3 py-1.75 pb-1.25 text-[25px] font-[950] tracking-[0.02em] text-(--mint) [text-shadow:0_2px_12px_rgba(0,0,0,0.3)]"
									style={`opacity:${yesStrength}`}
								>
									YES!
								</div>
								<div class="absolute right-0 bottom-0 left-0 p-6.25 pt-7 text-left">
									<div class="mb-2.25 flex items-center justify-between gap-3">
										<div class="flex items-center gap-2.25 text-xs font-bold text-[#d2cad8]">
											<span
												class="rounded-[99px] border border-white/17 bg-[rgba(12,10,16,0.45)] px-2.25 py-1.25 text-[9px] font-[850] tracking-[0.12em] uppercase backdrop-blur-lg"
												class:text-[#ff93a4]={currentItem.type === 'movie'}
												class:text-[#9c8cff]={currentItem.type === 'series'}
												>{mediaLabel(currentItem)}</span
											>
											<span>{currentItem.year}</span>
										</div>
										<div
											class="inline-flex min-h-7 flex-none items-center gap-1 rounded-[9px] border border-[rgba(255,207,92,0.24)] bg-[rgba(12,10,16,0.62)] px-2 py-1.25 shadow-[inset_0_1px_rgba(255,255,255,0.06)] backdrop-blur-[10px]"
											aria-label={`IMDb rating ${ratingLabel(currentItem)} out of 10`}
										>
											<span
												class="text-[11px] text-(--gold) drop-shadow-[0_0_5px_rgba(255,207,92,0.32)]"
												aria-hidden="true">★</span
											>
											<b class="text-xs leading-none tracking-[-0.02em] text-[#fff5d3]"
												>{ratingLabel(currentItem)}</b
											>
											<small
												class="ml-px text-[7px] font-[850] tracking-widest text-[#b7ad8a] uppercase"
												>IMDb</small
											>
										</div>
									</div>
									<h2
										class="m-0 max-w-[95%] text-[clamp(27px,8vw,38px)] leading-[0.98] font-[850] tracking-[-0.055em] text-balance"
									>
										{currentItem.title}
									</h2>
									<div
										class="mt-3 flex flex-wrap gap-1.5"
										aria-label={`Genres: ${currentItem.genres.join(', ')}`}
									>
										{#each currentItem.genres.slice(0, 3) as genre (genre)}
											<span
												class="rounded-full border border-white/11 bg-white/7.5 px-2 py-1.25 text-[8px] font-[750] tracking-[0.045em] text-[#ded8e5] shadow-[inset_0_1px_rgba(255,255,255,0.035)] backdrop-blur-lg"
												>{genre}</span
											>
										{/each}
									</div>
								</div>
							</article>
						{/key}
					{/if}
				</div>

				<div
					class="mt-6 flex items-center justify-center gap-6.25 [@media(max-height:760px)_and_(max-width:600px)]:mt-3.75"
				>
					<button
						class="grid size-14.5 cursor-pointer place-items-center rounded-full border border-white/13 bg-white/5.5 text-(--rose) shadow-[0_12px_28px_rgba(0,0,0,0.26),inset_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md transition-[transform,background] duration-150 ease-in-out hover:-translate-y-0.75 hover:scale-[1.04] hover:bg-[rgba(255,92,116,0.1)] active:scale-[0.94] [&_span]:-mt-1 [&_span]:text-[39px] [&_span]:leading-none [&_span]:font-[250]"
						onclick={() => decide(false)}
						aria-label="Pass"
					>
						<span>×</span>
					</button>
					<p
						class="m-0 flex flex-col gap-px text-[10px] text-[#6f6875] [&_b]:text-[11px] [&_b]:tracking-[0.08em] [&_b]:text-[#aaa3b1] [&_b]:uppercase"
					>
						<b>Swipe</b><span>or tap</span>
					</p>
					<button
						class="grid size-14.5 cursor-pointer place-items-center rounded-full border border-white/13 bg-white/5.5 text-(--mint) shadow-[0_12px_28px_rgba(0,0,0,0.26),inset_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md transition-[transform,background] duration-150 ease-in-out hover:-translate-y-0.75 hover:scale-[1.04] hover:bg-[rgba(66,232,193,0.1)] active:scale-[0.94] [&_span]:text-[25px] [&_span]:leading-none"
						onclick={() => decide(true)}
						aria-label="Like"
					>
						<span>♥</span>
					</button>
				</div>
				<p
					class="mt-3.25 text-[9px] text-[#5f5965] [&_kbd]:rounded-sm [&_kbd]:border [&_kbd]:border-white/12 [&_kbd]:px-1.25 [&_kbd]:pt-px [&_kbd]:pb-0.5 [&_kbd]:font-[inherit] [&_span]:mx-2 [@media(max-height:760px)_and_(max-width:600px)]:hidden"
				>
					<kbd>←</kbd> pass <span>•</span> like <kbd>→</kbd>
				</p>
			</section>
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
					<span class="h-px w-6 bg-(--rose) shadow-[0_0_10px_var(--rose)]"></span> You’re all caught up
				</div>
				<h1
					class="m-0 text-[clamp(42px,11vw,68px)] leading-[0.97] font-[850] tracking-[-0.065em] [&_em]:font-serif [&_em]:font-normal [&_em]:tracking-[-0.055em] [&_em]:text-(--rose)"
				>
					Cards down.<br /><em>Waiting on the crew.</em>
				</h1>
				<p class="mx-auto mt-5.5 max-w-127.5 text-[15px] leading-[1.65] text-(--muted)">
					Your votes are locked in. This screen will update the moment everyone finishes.
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
									>{Math.min(player.progress, player.total)} of {player.total}</span
								>
							</div>
							<i
								class="grid h-7.5 min-w-9.5 place-items-center rounded-[10px] bg-white/5 text-[9px] font-extrabold text-[#918a98] not-italic"
								class:bg-[rgba(66,232,193,0.09)]={player.progress >= player.total}
								class:text-[var(--mint)]={player.progress >= player.total}
							>
								{player.progress >= player.total
									? '✓'
									: `${Math.round((player.progress / player.total) * 100)}%`}
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
		{:else if party.phase === 'matched' && party.match}
			<section
				class="relative z-2 m-auto w-[min(100%,620px)] px-5.5 pt-5 pb-10.5 text-center max-[380px]:px-4"
			>
				<div
					class="mb-3.25 inline-flex items-center gap-2.5 text-[11px] font-black tracking-[0.22em] text-(--rose) [&_span]:animate-[heartbeat_1.2s_ease-in-out_infinite] [&_span]:text-[9px]"
				>
					<span>♥</span> IT’S A MATCH <span>♥</span>
				</div>
				<h1
					class="m-0 text-[clamp(40px,10vw,58px)] leading-[0.97] font-[850] tracking-[-0.065em] [&_em]:font-serif [&_em]:font-normal [&_em]:tracking-[-0.055em] [&_em]:text-(--rose)"
				>
					Tonight is <em>sorted.</em>
				</h1>
				<p
					class="mx-auto mt-5.5 max-w-127.5 text-[15px] leading-[1.65] text-(--muted) [@media(max-height:760px)_and_(max-width:600px)]:mt-2.5"
				>
					Everyone said yes. No more scrolling.
				</p>

				<div
					class="relative mx-auto mt-6.5 aspect-[0.7] w-[min(72vw,270px)] [@media(max-height:760px)_and_(max-width:600px)]:w-[min(57vw,230px)]"
				>
					<div
						class="absolute top-1/2 left-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2 animate-[reel-spin_18s_linear_infinite] rounded-full bg-[repeating-conic-gradient(from_10deg,rgba(255,92,116,0.12)_0_8deg,transparent_8deg_21deg)] [mask:radial-gradient(circle,transparent_0_23%,black_24%_64%,transparent_65%)]"
					></div>
					<article
						class="absolute inset-0 rotate-2 animate-[match-arrive_700ms_cubic-bezier(0.17,0.89,0.32,1.4)_both] overflow-hidden rounded-3xl border border-white/14 bg-[linear-gradient(145deg,#282131,#15121a)] shadow-[0_30px_80px_rgba(0,0,0,0.55),0_0_80px_rgba(255,92,116,0.16)]"
					>
						<img
							class="pointer-events-none size-full object-cover select-none"
							src={party.match.img}
							alt={`${party.match.title} poster`}
						/>
						<div
							class="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,8,0.02)_40%,rgba(5,4,8,0.42)_67%,rgba(5,4,8,0.97)_100%)]"
						></div>
						<div class="absolute right-0 bottom-0 left-0 px-4.75 pt-5.5 pb-4.5 text-left">
							<div class="mb-2.25 flex items-center justify-between gap-1.75">
								<div class="flex items-center gap-2.25 text-xs font-bold text-[#d2cad8]">
									<span
										class="rounded-[99px] border border-white/17 bg-[rgba(12,10,16,0.45)] px-2.25 py-1.25 text-[9px] font-[850] tracking-[0.12em] uppercase backdrop-blur-lg"
										class:text-[#ff93a4]={party.match.type === 'movie'}
										class:text-[#9c8cff]={party.match.type === 'series'}
										>{mediaLabel(party.match)}</span
									>
									<span>{party.match.year}</span>
								</div>
								<div
									class="inline-flex min-h-6 flex-none items-center gap-1 rounded-[9px] border border-[rgba(255,207,92,0.24)] bg-[rgba(12,10,16,0.62)] px-1.5 py-1 shadow-[inset_0_1px_rgba(255,255,255,0.06)] backdrop-blur-[10px]"
									aria-label={`IMDb rating ${ratingLabel(party.match)} out of 10`}
								>
									<span
										class="text-[11px] text-(--gold) drop-shadow-[0_0_5px_rgba(255,207,92,0.32)]"
										aria-hidden="true">★</span
									>
									<b class="text-xs leading-none tracking-[-0.02em] text-[#fff5d3]"
										>{ratingLabel(party.match)}</b
									>
								</div>
							</div>
							<h2
								class="m-0 max-w-[95%] text-[clamp(22px,6vw,30px)] leading-[0.98] font-[850] tracking-[-0.055em] text-balance"
							>
								{party.match.title}
							</h2>
							<div
								class="mt-2 flex flex-wrap gap-1"
								aria-label={`Genres: ${party.match.genres.join(', ')}`}
							>
								{#each party.match.genres.slice(0, 3) as genre (genre)}
									<span
										class="rounded-full border border-white/11 bg-white/7.5 px-1.5 py-1 text-[7px] font-[750] tracking-[0.045em] text-[#ded8e5] shadow-[inset_0_1px_rgba(255,255,255,0.035)] backdrop-blur-lg"
										>{genre}</span
									>
								{/each}
							</div>
						</div>
					</article>
					<div
						class="absolute -right-4.25 bottom-9.5 grid size-13.5 animate-[heartbeat_1.2s_ease-in-out_infinite] place-items-center rounded-full border-4 border-[#0b0910] bg-[linear-gradient(145deg,#ff7b85,#f2385a)] text-xl text-white shadow-[0_10px_25px_rgba(255,63,102,0.4)]"
					>
						♥
					</div>
				</div>

				<div
					class="mt-5 flex items-center justify-center gap-3 text-[10px] font-[650] text-(--muted)"
				>
					<div class="flex pl-2">
						{#each party.players as player (player.id)}
							<span
								class={`-ml-2 grid size-7.5 flex-none place-items-center rounded-[10px] border-2 border-[#0b0910] text-[8px] font-[850] tracking-[-0.02em] shadow-[inset_0_1px_rgba(255,255,255,0.18)] ${avatarColor(player.avatar)}`}
								>{playerInitials(player.name)}</span
							>
						{/each}
					</div>
					<span>Matched by everyone</span>
				</div>

				<button
					class="mx-auto mt-4.5 flex w-[min(100%,270px)] cursor-pointer items-center justify-center gap-2.5 rounded-[17px] border border-white/12 bg-white/5.5 px-4.5 py-3.25 text-xs font-extrabold tracking-[-0.02em] text-[#ddd7e5] transition-[transform,box-shadow,opacity] duration-150 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(255,63,102,0.32)] active:translate-y-px active:scale-[0.99]"
					onclick={sendAgain}>Find another <span>↻</span></button
				>
			</section>
		{:else}
			<section
				class="relative z-2 m-auto w-[min(100%,620px)] max-w-125 px-5.5 pt-7 pb-10.5 text-center max-[380px]:px-4"
			>
				<div
					class="relative mx-auto mb-6.5 grid size-25 rotate-[-7deg] grid-cols-2 gap-1.75 rounded-full border-4 border-[#7f7589] p-4.25 shadow-[inset_0_0_0_5px_#15111b] [&_i]:block [&_i]:rounded-full [&_i]:border-[3px] [&_i]:border-[#7f7589] [&_i:nth-child(3)]:absolute [&_i:nth-child(3)]:right-3.25 [&_i:nth-child(3)]:bottom-3.5 [&_i:nth-child(3)]:left-3.25 [&_i:nth-child(3)]:h-4"
				>
					<i></i><i></i><i></i>
				</div>
				<div
					class="mb-5 inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.18em] text-[#d7d0e2] uppercase"
				>
					<span class="h-px w-6 bg-(--rose) shadow-[0_0_10px_var(--rose)]"></span> Plot twist
				</div>
				<h1
					class="m-0 text-[clamp(42px,11vw,68px)] leading-[0.97] font-[850] tracking-[-0.065em] [&_em]:font-serif [&_em]:font-normal [&_em]:tracking-[-0.055em] [&_em]:text-(--rose)"
				>
					No match<br /><em>this round.</em>
				</h1>
				<p class="mx-auto mt-5.5 max-w-127.5 text-[15px] leading-[1.65] text-(--muted)">
					Great taste. Terrible overlap. Shuffle the deck and give it another shot.
				</p>
				<button
					class="relative mx-auto mt-7.5 flex w-full max-w-87.5 cursor-pointer items-center justify-between rounded-[17px] border-0 bg-[linear-gradient(110deg,#ff5c74,#ff7b66)] px-5 py-4.25 font-extrabold tracking-[-0.02em] text-[#120a0f] shadow-[0_14px_34px_rgba(255,63,102,0.24),inset_0_1px_rgba(255,255,255,0.35)] transition-[transform,box-shadow,opacity] duration-150 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(255,63,102,0.32)] active:translate-y-px active:scale-[0.99] [&_b]:text-[23px] [&_b]:leading-none"
					onclick={sendAgain}
				>
					<span>Shuffle & try again</span><b>↻</b>
				</button>
			</section>
		{/if}
	</main>

	<footer
		class="relative z-2 flex items-center justify-center gap-2.5 px-5 pt-2 pb-[max(18px,env(safe-area-inset-bottom))] text-[9px] tracking-[0.04em] text-[#514b57]"
	>
		<span class="font-extrabold">reelmate</span>
		<i class="size-0.75 rounded-full bg-[#514b57]"></i>
		<p class="m-0">Less browsing. More watching.</p>
	</footer>
</div>
