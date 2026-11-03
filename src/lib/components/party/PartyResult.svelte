<script lang="ts">
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
	let { party, onagain }: { party: PartyState; onagain: () => void } = $props();
</script>

{#if party.phase === 'matched' && party.match}
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
					src={posterSource(party.match)}
					alt={`${party.match.title} poster`}
					onerror={useDefaultPoster}
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
								class:text-[#9c8cff]={party.match.type === 'series'}>{mediaLabel(party.match)}</span
							>
							<span>{party.match.year}</span>
						</div>
						<div
							class="inline-flex min-h-6 flex-none items-center gap-1 rounded-[9px] border border-[rgba(255,207,92,0.24)] bg-[rgba(12,10,16,0.62)] px-1.5 py-1 shadow-[inset_0_1px_rgba(255,255,255,0.06)] backdrop-blur-[10px]"
							aria-label={ratingAriaLabel(party.match)}
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

		<div class="mt-5 flex items-center justify-center gap-3 text-[10px] font-[650] text-(--muted)">
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
			onclick={onagain}>Find another <span>↻</span></button
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
			onclick={onagain}
		>
			<span>Shuffle & try again</span><b>↻</b>
		</button>
	</section>
{/if}
