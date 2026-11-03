<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { PartyState } from '#lib/types.js';
	import {
		avatarColor,
		playerInitials,
		mediaLabel,
		ratingLabel,
		ratingAriaLabel,
		posterSource,
		useDefaultPoster
	} from '#lib/party-presentation.js';
	let {
		party,
		activeProgress,
		voteError,
		onvote
	}: {
		party: PartyState;
		activeProgress: number;
		voteError: string;
		onvote: (liked: boolean) => void;
	} = $props();
	const currentItem = $derived(party.deck[activeProgress]);
	const nextItem = $derived(party.deck[activeProgress + 1]);
	const thirdItem = $derived(party.deck[activeProgress + 2]);
	let dragX = $state(0);
	let dragging = $state(false);
	let cardFlipped = $state(false);
	let leaving = $state(false);
	let dragStart = 0;
	let pointerMoved = false;
	let activeTouchId: number | null = null;

	let voteSendTimer: ReturnType<typeof setTimeout> | undefined;
	const yesStrength = $derived(Math.min(1, Math.max(0, dragX / 110)));
	const noStrength = $derived(Math.min(1, Math.max(0, -dragX / 110)));
	const cardTransform = $derived(
		`transform: translate3d(${dragX}px, 0, 0) rotate(${dragX / 19}deg); transition: ${dragging ? 'none' : 'transform 260ms cubic-bezier(.2,.9,.2,1)'};`
	);
	onDestroy(() => {
		if (voteSendTimer) clearTimeout(voteSendTimer);
	});
	function decide(liked: boolean) {
		if (!currentItem || leaving) return;
		leaving = true;
		dragging = false;
		cardFlipped = false;
		dragX = (liked ? 1 : -1) * Math.max(window.innerWidth, 520);
		voteSendTimer = setTimeout(() => {
			voteSendTimer = undefined;
			onvote(liked);
		}, 190);
	}
	function beginDrag(clientX: number) {
		if (leaving) return;
		dragging = true;
		pointerMoved = false;
		dragStart = clientX - dragX;
	}

	function moveDrag(clientX: number) {
		if (!dragging || leaving) return;
		dragX = clientX - dragStart;
		if (Math.abs(dragX) > 6) pointerMoved = true;
	}

	function finishDrag() {
		if (!dragging) return;
		dragging = false;
		if (Math.abs(dragX) >= 88) decide(dragX > 0);
		else {
			dragX = 0;
			if (!pointerMoved && currentItem?.plot?.trim()) cardFlipped = !cardFlipped;
		}
	}

	function cancelDrag() {
		activeTouchId = null;
		if (!dragging) return;
		dragging = false;
		dragX = 0;
		pointerMoved = false;
	}

	function pointerDown(event: PointerEvent) {
		// Mobile browsers also emit Touch Events. Handle touch through that API so
		// installed iOS/Android web apps are not dependent on pointer capture.
		if (event.pointerType === 'touch') return;
		beginDrag(event.clientX);
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// Capture is an enhancement; the drag still works while the pointer stays on the card.
		}
	}

	function pointerMove(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		moveDrag(event.clientX);
	}

	function pointerUp(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		moveDrag(event.clientX);
		finishDrag();
	}

	function pointerCancel(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		cancelDrag();
	}

	function findTouch(touches: TouchList, identifier: number) {
		for (let index = 0; index < touches.length; index += 1) {
			const touch = touches.item(index);
			if (touch?.identifier === identifier) return touch;
		}
		return null;
	}

	function touchStart(event: TouchEvent) {
		if (activeTouchId !== null || event.touches.length !== 1 || leaving) return;
		const touch = event.changedTouches.item(0);
		if (!touch) return;
		event.preventDefault();
		activeTouchId = touch.identifier;
		beginDrag(touch.clientX);
	}

	function touchMove(event: TouchEvent) {
		if (activeTouchId === null) return;
		const touch = findTouch(event.changedTouches, activeTouchId);
		if (!touch) return;
		event.preventDefault();
		moveDrag(touch.clientX);
	}

	function touchEnd(event: TouchEvent) {
		if (activeTouchId === null) return;
		const touch = findTouch(event.changedTouches, activeTouchId);
		if (!touch) return;
		moveDrag(touch.clientX);
		activeTouchId = null;
		finishDrag();
	}

	function touchCancel(event: TouchEvent) {
		if (activeTouchId === null || !findTouch(event.changedTouches, activeTouchId)) return;
		activeTouchId = null;
		cancelDrag();
	}

	function mobileSwipe(node: HTMLElement) {
		const nonPassive = { passive: false } as const;
		node.addEventListener('touchstart', touchStart, nonPassive);
		node.addEventListener('touchmove', touchMove, nonPassive);
		node.addEventListener('touchend', touchEnd);
		node.addEventListener('touchcancel', touchCancel);

		return {
			destroy() {
				node.removeEventListener('touchstart', touchStart);
				node.removeEventListener('touchmove', touchMove);
				node.removeEventListener('touchend', touchEnd);
				node.removeEventListener('touchcancel', touchCancel);
			}
		};
	}

	function handleCardKey(event: KeyboardEvent) {
		if (!currentItem?.plot?.trim() || leaving) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		cardFlipped = !cardFlipped;
	}

	function handleKey(event: KeyboardEvent) {
		if (!currentItem || leaving) return;
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			target.closest('input, textarea, select, [contenteditable="true"]')
		)
			return;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.preventDefault();
		if (event.key === 'ArrowLeft') decide(false);
		if (event.key === 'ArrowRight') decide(true);
	}
</script>

<svelte:window onkeydown={handleKey} onblur={cancelDrag} />
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
			<b>{activeProgress + 1}</b><span>/</span>{party.deck.length}
		</div>
	</div>
	<div class="mb-5 h-0.75 overflow-hidden rounded-[99px] bg-white/7">
		<span
			class="block h-full rounded-[inherit] bg-[linear-gradient(90deg,var(--rose),var(--purple))] shadow-[0_0_12px_rgba(255,92,116,0.5)] transition-[width] duration-300 ease-in-out"
			style={`width:${(activeProgress / party.deck.length) * 100}%`}
		></span>
	</div>
	{#if voteError}
		<p class="-mt-2 mb-3 text-xs font-semibold text-[#ff8ca0]" role="alert">
			{voteError}
		</p>
	{/if}

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
					src={posterSource(nextItem)}
					alt=""
					onerror={useDefaultPoster}
				/>
			</div>
		{/if}
		{#if currentItem}
			<div
				class="absolute inset-0 z-3 cursor-grab touch-none overflow-hidden rounded-[28px] border border-white/14 bg-[linear-gradient(145deg,#282131,#15121a)] shadow-[0_25px_60px_rgba(0,0,0,0.48),inset_0_1px_rgba(255,255,255,0.08)] will-change-transform max-[380px]:rounded-3xl"
				class:cursor-grabbing={dragging}
				style={cardTransform}
				role="button"
				tabindex="0"
				aria-pressed={currentItem.plot?.trim() ? cardFlipped : undefined}
				aria-label={currentItem.plot?.trim()
					? `${currentItem.title}. ${cardFlipped ? 'Showing plot. Press Enter to return to the poster.' : 'Press Enter to show the plot.'}`
					: `${currentItem.title}. Swipe left to pass or right to like.`}
				onpointerdown={pointerDown}
				onpointermove={pointerMove}
				onpointerup={pointerUp}
				onpointercancel={pointerCancel}
				onlostpointercapture={pointerCancel}
				use:mobileSwipe
				onkeydown={handleCardKey}
			>
				<div
					class="relative size-full transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] will-change-transform transform-3d motion-reduce:transition-none"
					style={`-webkit-transform-style: preserve-3d; transform-style: preserve-3d; transform: rotateY(${cardFlipped ? 180 : 0}deg);`}
				>
					<div
						aria-hidden={cardFlipped}
						class="absolute inset-0 overflow-hidden backface-hidden"
						style="-webkit-backface-visibility: hidden; backface-visibility: hidden; -webkit-transform: translateZ(0.1px); transform: translateZ(0.1px);"
					>
						<img
							class="pointer-events-none size-full object-cover select-none"
							src={posterSource(currentItem)}
							alt={`${currentItem.title} poster`}
							draggable="false"
							onerror={useDefaultPoster}
						/>
						<div
							class="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,8,0.02)_40%,rgba(5,4,8,0.42)_67%,rgba(5,4,8,0.97)_100%)]"
						></div>
						{#if currentItem.plot?.trim()}
							<div
								class="absolute top-5 left-1/2 -translate-x-1/2 rounded-full border border-white/14 bg-black/45 px-3 py-1.5 text-[8px] font-extrabold tracking-[0.12em] text-white/75 uppercase backdrop-blur-md"
							>
								Tap for plot
							</div>
						{/if}
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
									aria-label={ratingAriaLabel(currentItem)}
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
										>{currentItem.ratingSource ?? 'IMDb'}</small
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
					</div>
					<div
						aria-hidden={!cardFlipped}
						class="absolute inset-0 transform-[rotateY(180deg)] overflow-hidden bg-[linear-gradient(145deg,#201a2b,#100e15)] backface-hidden"
						style="-webkit-backface-visibility: hidden; backface-visibility: hidden; -webkit-transform: rotateY(180deg) translateZ(0.1px); transform: rotateY(180deg) translateZ(0.1px);"
					>
						<img
							class="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-12 blur-md select-none"
							src={posterSource(currentItem)}
							alt=""
							draggable="false"
							onerror={useDefaultPoster}
						/>
						<div
							class="absolute inset-0 bg-[linear-gradient(160deg,rgba(36,27,70,.92),rgba(11,9,16,.98)_70%)]"
						></div>
						<div class="relative flex size-full flex-col p-6.25 text-left">
							<div class="flex items-center justify-between gap-3">
								<span class="text-[9px] font-extrabold tracking-[0.18em] text-(--rose) uppercase"
									>Plot</span
								>
								<span class="text-[9px] font-bold text-white/45">Tap to return</span>
							</div>
							<h2
								class="mt-5 text-[clamp(26px,7vw,36px)] leading-[1.02] font-[850] tracking-tighter text-balance"
							>
								{currentItem.title}
							</h2>
							<div class="mt-4 flex flex-wrap gap-1.5">
								{#each currentItem.genres.slice(0, 3) as genre (genre)}
									<span
										class="rounded-full border border-white/11 bg-white/7 px-2 py-1 text-[8px] font-bold text-white/70"
										>{genre}</span
									>
								{/each}
							</div>
							<p
								class="mt-6 min-h-0 flex-1 overflow-y-auto pr-1 text-[clamp(13px,3.6vw,15px)] leading-[1.7] whitespace-pre-line text-[#ddd7e5]"
							>
								{currentItem.plot}
							</p>
							<p
								class="mt-5 border-t border-white/9 pt-4 text-[9px] font-bold tracking-[0.08em] text-white/40 uppercase"
							>
								Swipe or use the buttons when you are ready
							</p>
						</div>
					</div>
				</div>
			</div>
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
